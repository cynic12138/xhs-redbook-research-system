import { createHash, timingSafeEqual } from "node:crypto";
import type {
  BrowserBridgeBrowser,
  BrowserExtensionPairingStatus,
  CompleteExtensionPairingInput,
  StartExtensionPairingInput
} from "../../shared/types.js";
import {
  BrowserExtensionPairingRepository,
  type BrowserExtensionPairingRecord
} from "../storage/browserExtensionPairingRepository.js";

const PAIRING_TTL_MS = 5 * 60_000;
const MAX_PAIRING_ATTEMPTS = 5;

interface PairingSession {
  codeHash: Buffer;
  expiresAt: number;
  attemptsRemaining: number;
}

interface PairingServiceOptions {
  now?: () => Date;
}

export class BrowserExtensionPairingError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
    this.name = "BrowserExtensionPairingError";
  }
}

export class BrowserExtensionPairingService {
  private readonly now: () => Date;
  private session: PairingSession | undefined;
  private terminalState: "expired" | undefined;

  constructor(
    private readonly repository: BrowserExtensionPairingRepository,
    options: PairingServiceOptions = {}
  ) {
    this.now = options.now ?? (() => new Date());
  }

  start(input: StartExtensionPairingInput): BrowserExtensionPairingStatus {
    if (!/^[a-f0-9]{64}$/.test(input.codeHash)) {
      throw new BrowserExtensionPairingError("配对码摘要格式无效。", 400);
    }
    const now = this.now().getTime();
    this.session = {
      codeHash: Buffer.from(input.codeHash, "hex"),
      expiresAt: now + PAIRING_TTL_MS,
      attemptsRemaining: MAX_PAIRING_ATTEMPTS
    };
    this.terminalState = undefined;
    return this.status();
  }

  complete(input: CompleteExtensionPairingInput): BrowserExtensionPairingStatus {
    validateCompletion(input);
    const session = this.session;
    if (!session) {
      throw new BrowserExtensionPairingError("当前没有等待完成的扩展配对。", 409);
    }
    const now = this.now();
    if (now.getTime() > session.expiresAt) {
      this.session = undefined;
      this.terminalState = "expired";
      throw new BrowserExtensionPairingError("扩展配对码已过期，请重新生成。", 410);
    }

    const providedCodeHash = sha256(input.code);
    if (!timingSafeEqual(providedCodeHash, session.codeHash)) {
      session.attemptsRemaining -= 1;
      if (session.attemptsRemaining <= 0) {
        this.session = undefined;
        throw new BrowserExtensionPairingError("扩展配对尝试次数已用完，请重新生成配对码。", 429);
      }
      throw new BrowserExtensionPairingError("扩展配对码不正确。", 401);
    }

    const timestamp = now.toISOString();
    this.repository.replace({
      tokenHash: sha256(input.token),
      extensionId: input.extensionId,
      browser: input.browser,
      extensionVersion: input.extensionVersion,
      pairedAt: timestamp,
      lastSeenAt: timestamp
    });
    this.session = undefined;
    this.terminalState = undefined;
    return this.status();
  }

  cancel(): BrowserExtensionPairingStatus {
    this.session = undefined;
    this.terminalState = undefined;
    return this.status();
  }

  revoke(): BrowserExtensionPairingStatus {
    this.session = undefined;
    this.terminalState = undefined;
    this.repository.delete();
    return this.status();
  }

  authenticate(token: string, extensionId?: string): boolean {
    if (!isValidToken(token)) return false;
    const pairing = this.repository.get();
    if (!pairing || (extensionId && extensionId !== pairing.extensionId)) return false;
    const candidate = sha256(token);
    return candidate.length === pairing.tokenHash.length && timingSafeEqual(candidate, pairing.tokenHash);
  }

  markSeen(synchronized = false): BrowserExtensionPairingStatus {
    const timestamp = this.now().toISOString();
    this.repository.touch({
      lastSeenAt: timestamp,
      lastSyncAt: synchronized ? timestamp : undefined
    });
    return this.status();
  }

  status(): BrowserExtensionPairingStatus {
    const pairing = this.repository.get();
    if (this.session) {
      if (this.now().getTime() > this.session.expiresAt) {
        this.session = undefined;
        this.terminalState = "expired";
      } else {
        return {
          ...mapPairing(pairing),
          state: "pairing",
          expiresAt: new Date(this.session.expiresAt).toISOString(),
          attemptsRemaining: this.session.attemptsRemaining,
          message: "等待浏览器扩展输入配对码。"
        };
      }
    }
    if (this.terminalState === "expired") {
      return {
        ...mapPairing(pairing),
        state: "expired",
        message: "扩展配对码已过期，请重新生成。"
      };
    }
    if (!pairing) return { state: "unpaired", message: "浏览器扩展尚未配对。" };
    return { ...mapPairing(pairing), state: "paired", message: "浏览器扩展已配对。" };
  }
}

function mapPairing(pairing: BrowserExtensionPairingRecord | undefined): Omit<BrowserExtensionPairingStatus, "state"> {
  if (!pairing) return {};
  return {
    browser: pairing.browser,
    extensionVersion: pairing.extensionVersion,
    pairedAt: pairing.pairedAt,
    lastSeenAt: pairing.lastSeenAt,
    lastSyncAt: pairing.lastSyncAt
  };
}

function validateCompletion(input: CompleteExtensionPairingInput): void {
  if (!/^\d{6}$/.test(input.code)) {
    throw new BrowserExtensionPairingError("配对码必须是 6 位数字。", 400);
  }
  if (!isValidToken(input.token)) {
    throw new BrowserExtensionPairingError("扩展令牌格式无效。", 400);
  }
  if (!/^[a-p]{32}$/.test(input.extensionId)) {
    throw new BrowserExtensionPairingError("扩展 ID 格式无效。", 400);
  }
  if (!isBrowser(input.browser)) {
    throw new BrowserExtensionPairingError("浏览器类型无效。", 400);
  }
}

function isValidToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value) && Buffer.from(value, "base64url").length === 32;
}

function isBrowser(value: string): value is BrowserBridgeBrowser {
  return value === "edge" || value === "chrome" || value === "unknown";
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}
