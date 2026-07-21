import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { getRuntimePaths } from "../runtime/runtimePaths.js";
import {
  getCollectionDefault,
  type CollectionName,
  type CollectionValue,
  type StoreLike
} from "./storageContract.js";

export type { CollectionName, CollectionValue, StoreLike } from "./storageContract.js";

export class LocalStore implements StoreLike {
  private readonly dataDir: string;
  private readonly locks = new Map<CollectionName, Promise<unknown>>();

  constructor(dataDir = getRuntimePaths().dataDir) {
    this.dataDir = dataDir;
  }

  async read<K extends CollectionName>(name: K): Promise<CollectionValue[K]> {
    await this.ensureDataDir();
    const filePath = this.pathFor(name);
    if (!existsSync(filePath)) {
      return getCollectionDefault(name);
    }

    const raw = await readFile(filePath, "utf8");
    if (!raw.trim()) {
      return getCollectionDefault(name);
    }
    return JSON.parse(raw) as CollectionValue[K];
  }

  async write<K extends CollectionName>(name: K, value: CollectionValue[K]): Promise<void> {
    await this.withCollectionLock(name, () => this.writeUnlocked(name, value));
  }

  async update<K extends CollectionName>(
    name: K,
    updater: (value: CollectionValue[K]) => CollectionValue[K] | Promise<CollectionValue[K]>
  ): Promise<CollectionValue[K]> {
    return this.withCollectionLock(name, async () => {
      const current = await this.read(name);
      const next = await updater(current);
      await this.writeUnlocked(name, next);
      return next;
    });
  }

  private async writeUnlocked<K extends CollectionName>(name: K, value: CollectionValue[K]): Promise<void> {
    await this.ensureDataDir();
    const filePath = this.pathFor(name);
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    await writeFile(tmpPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await renameWithRetry(tmpPath, filePath);
  }

  private async ensureDataDir(): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
  }

  private pathFor(name: CollectionName): string {
    return path.join(this.dataDir, `${name}.json`);
  }

  private async withCollectionLock<T>(name: CollectionName, task: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(name) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const chained = previous.then(() => current, () => current);
    this.locks.set(name, chained);
    await previous.catch(() => undefined);
    try {
      return await task();
    } finally {
      release();
      if (this.locks.get(name) === chained) {
        this.locks.delete(name);
      }
    }
  }
}

async function renameWithRetry(source: string, target: string): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await rename(source, target);
      return;
    } catch (error) {
      if (!isTransientFsError(error) || attempt === 5) {
        throw error;
      }
      await sleep(60 * (attempt + 1));
    }
  }
}

function isTransientFsError(error: unknown): boolean {
  const code = (error as { code?: string }).code;
  return code === "EPERM" || code === "EACCES" || code === "EBUSY";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
