import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, open, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip, createGzip } from "node:zlib";
import { z } from "zod";

const PACKAGE_MAGIC = Buffer.from("XHSOPS01", "ascii");
const HEADER_BYTES = PACKAGE_MAGIC.length + 4;
const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_PACKAGE_BYTES = 4 * 1024 * 1024 * 1024;
const MAX_PAYLOAD_BYTES = 8 * 1024 * 1024 * 1024;

const dataPackageManifestSchema = z.object({
  formatVersion: z.literal(1),
  kind: z.enum(["full-backup", "credential-free-migration"]),
  createdAt: z.string().datetime(),
  appVersion: z.string().min(1).max(64),
  schemaVersion: z.number().int().nonnegative(),
  payloadEncoding: z.literal("gzip"),
  payloadBytes: z.number().int().nonnegative().max(MAX_PAYLOAD_BYTES),
  payloadSha256: z.string().regex(/^[a-f0-9]{64}$/),
  counts: z.record(z.string(), z.number().int().nonnegative()),
  credentialsIncluded: z.boolean()
});

export type DataPackageManifest = z.infer<typeof dataPackageManifestSchema>;

export interface WriteDataPackageInput {
  sourceDatabaseFile: string;
  destinationFile: string;
  kind: DataPackageManifest["kind"];
  appVersion: string;
  schemaVersion: number;
  counts: Record<string, number>;
  credentialsIncluded: boolean;
  createdAt?: string;
}

export interface ExtractedDataPackage {
  manifest: DataPackageManifest;
  fingerprint: string;
  packageBytes: number;
}

export async function writeDataPackage(input: WriteDataPackageInput): Promise<DataPackageManifest> {
  const payload = await hashFile(input.sourceDatabaseFile);
  const manifest = dataPackageManifestSchema.parse({
    formatVersion: 1,
    kind: input.kind,
    createdAt: input.createdAt ?? new Date().toISOString(),
    appVersion: input.appVersion,
    schemaVersion: input.schemaVersion,
    payloadEncoding: "gzip",
    payloadBytes: payload.bytes,
    payloadSha256: payload.sha256,
    counts: input.counts,
    credentialsIncluded: input.credentialsIncluded
  });
  const manifestBytes = Buffer.from(JSON.stringify(manifest), "utf8");
  if (manifestBytes.length > MAX_MANIFEST_BYTES) {
    throw new Error("数据包清单过大，无法导出。");
  }
  await mkdir(path.dirname(input.destinationFile), { recursive: true });
  const temporaryFile = `${input.destinationFile}.partial-${process.pid}-${Date.now()}`;
  const header = Buffer.alloc(HEADER_BYTES);
  PACKAGE_MAGIC.copy(header, 0);
  header.writeUInt32BE(manifestBytes.length, PACKAGE_MAGIC.length);

  try {
    await writeFile(temporaryFile, Buffer.concat([header, manifestBytes]), { flag: "wx" });
    await pipeline(
      createReadStream(input.sourceDatabaseFile),
      createGzip({ level: 6 }),
      createWriteStream(temporaryFile, { flags: "a" })
    );
    await rename(temporaryFile, input.destinationFile);
    return manifest;
  } catch (error) {
    await rm(temporaryFile, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function extractDataPackage(packageFile: string, destinationDatabaseFile: string): Promise<ExtractedDataPackage> {
  const packageStat = await stat(packageFile);
  if (packageStat.size > MAX_PACKAGE_BYTES) throw new Error("数据包文件过大，已拒绝读取。");
  const { manifest, payloadOffset } = await readDataPackageManifest(packageFile);
  const packageHash = await hashFile(packageFile);
  await mkdir(path.dirname(destinationDatabaseFile), { recursive: true });
  const temporaryFile = `${destinationDatabaseFile}.partial-${process.pid}-${Date.now()}`;
  const payloadHash = createHash("sha256");
  let payloadBytes = 0;
  const verifier = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      payloadBytes += chunk.length;
      if (payloadBytes > manifest.payloadBytes || payloadBytes > MAX_PAYLOAD_BYTES) {
        callback(new Error("数据包解压大小超过清单限制。"));
        return;
      }
      payloadHash.update(chunk);
      callback(null, chunk);
    }
  });

  try {
    await pipeline(
      createReadStream(packageFile, { start: payloadOffset }),
      createGunzip(),
      verifier,
      createWriteStream(temporaryFile, { flags: "wx" })
    );
    const digest = payloadHash.digest("hex");
    if (digest !== manifest.payloadSha256 || payloadBytes !== manifest.payloadBytes) {
      throw new Error("数据包内容校验失败，文件可能已损坏。");
    }
    await rename(temporaryFile, destinationDatabaseFile);
    return {
      manifest,
      fingerprint: packageHash.sha256,
      packageBytes: packageHash.bytes
    };
  } catch (error) {
    await rm(temporaryFile, { force: true }).catch(() => undefined);
    if (error instanceof Error && /数据包/.test(error.message)) throw error;
    throw new Error("数据包损坏或无法解压。", { cause: error });
  }
}

export async function readDataPackageManifest(packageFile: string): Promise<{
  manifest: DataPackageManifest;
  payloadOffset: number;
}> {
  const handle = await open(packageFile, "r");
  try {
    const header = Buffer.alloc(HEADER_BYTES);
    const headerRead = await handle.read(header, 0, header.length, 0);
    if (headerRead.bytesRead !== header.length || !header.subarray(0, PACKAGE_MAGIC.length).equals(PACKAGE_MAGIC)) {
      throw new Error("所选文件不是有效的小红书运营台数据包。");
    }
    const manifestLength = header.readUInt32BE(PACKAGE_MAGIC.length);
    if (manifestLength < 2 || manifestLength > MAX_MANIFEST_BYTES) {
      throw new Error("数据包清单损坏。");
    }
    const manifestBytes = Buffer.alloc(manifestLength);
    const manifestRead = await handle.read(manifestBytes, 0, manifestLength, HEADER_BYTES);
    if (manifestRead.bytesRead !== manifestLength) throw new Error("数据包清单不完整。");
    let parsed: unknown;
    try {
      parsed = JSON.parse(manifestBytes.toString("utf8"));
    } catch (error) {
      throw new Error("数据包清单损坏。", { cause: error });
    }
    const result = dataPackageManifestSchema.safeParse(parsed);
    if (!result.success) throw new Error("数据包清单不符合当前版本要求。");
    return { manifest: result.data, payloadOffset: HEADER_BYTES + manifestLength };
  } finally {
    await handle.close();
  }
}

async function hashFile(file: string): Promise<{ sha256: string; bytes: number }> {
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(file)) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    hash.update(buffer);
    bytes += buffer.length;
  }
  const fileStat = await stat(file);
  return { sha256: hash.digest("hex"), bytes: fileStat.size || bytes };
}
