import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("portable data package", () => {
  it("round-trips a gzip SQLite payload with a verified manifest", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "xhs-data-package-"));
    tempDirs.push(dir);
    const source = path.join(dir, "source.db");
    const packageFile = path.join(dir, "backup.xhsbackup");
    const extracted = path.join(dir, "extracted.db");
    await writeFile(source, Buffer.from("sqlite-fixture-payload"));

    const { writeDataPackage, extractDataPackage } = await import("../src/server/storage/dataPackage.js");
    const manifest = await writeDataPackage({
      sourceDatabaseFile: source,
      destinationFile: packageFile,
      kind: "full-backup",
      appVersion: "0.5.0",
      schemaVersion: 3,
      counts: { aiArtifacts: 2 },
      credentialsIncluded: true,
      createdAt: "2026-07-22T08:00:00.000Z"
    });
    const result = await extractDataPackage(packageFile, extracted);

    expect(manifest).toMatchObject({
      formatVersion: 1,
      kind: "full-backup",
      payloadEncoding: "gzip",
      credentialsIncluded: true
    });
    expect(result.manifest).toEqual(manifest);
    expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(await readFile(extracted)).toEqual(await readFile(source));
  });

  it("rejects a package whose compressed payload was modified", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "xhs-data-package-corrupt-"));
    tempDirs.push(dir);
    const source = path.join(dir, "source.db");
    const packageFile = path.join(dir, "backup.xhsbackup");
    await writeFile(source, Buffer.from("sqlite-fixture-payload"));
    const { writeDataPackage, extractDataPackage } = await import("../src/server/storage/dataPackage.js");
    await writeDataPackage({
      sourceDatabaseFile: source,
      destinationFile: packageFile,
      kind: "full-backup",
      appVersion: "0.5.0",
      schemaVersion: 3,
      counts: {},
      credentialsIncluded: true
    });
    const bytes = await readFile(packageFile);
    bytes[bytes.length - 1] ^= 0xff;
    await writeFile(packageFile, bytes);

    await expect(extractDataPackage(packageFile, path.join(dir, "extracted.db")))
      .rejects.toThrow(/损坏|校验/);
    expect((await readdir(dir)).some((file) => file.includes(".partial-"))).toBe(false);
  });

  it("rejects files without the package magic", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "xhs-data-package-magic-"));
    tempDirs.push(dir);
    const packageFile = path.join(dir, "invalid.xhsmigrate");
    await writeFile(packageFile, Buffer.from("not-a-package"));
    const { extractDataPackage } = await import("../src/server/storage/dataPackage.js");

    await expect(extractDataPackage(packageFile, path.join(dir, "extracted.db")))
      .rejects.toThrow("不是有效的小红书运营台数据包");
  });

  it("rejects an oversized declared database before decompression", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "xhs-data-package-limit-"));
    tempDirs.push(dir);
    const source = path.join(dir, "source.db");
    const packageFile = path.join(dir, "backup.xhsbackup");
    await writeFile(source, Buffer.alloc(20, 1));
    const { writeDataPackage, extractDataPackage } = await import("../src/server/storage/dataPackage.js");
    await writeDataPackage({
      sourceDatabaseFile: source,
      destinationFile: packageFile,
      kind: "full-backup",
      appVersion: "0.5.0",
      schemaVersion: 3,
      counts: {},
      credentialsIncluded: true
    });
    const bytes = await readFile(packageFile);
    const manifestLength = bytes.readUInt32BE(8);
    const manifest = JSON.parse(bytes.subarray(12, 12 + manifestLength).toString("utf8")) as Record<string, unknown>;
    manifest.payloadBytes = 999_999_999_999;
    const nextManifest = Buffer.from(JSON.stringify(manifest), "utf8");
    const header = Buffer.from(bytes.subarray(0, 12));
    header.writeUInt32BE(nextManifest.length, 8);
    await writeFile(packageFile, Buffer.concat([header, nextManifest, bytes.subarray(12 + manifestLength)]));

    await expect(extractDataPackage(packageFile, path.join(dir, "extracted.db")))
      .rejects.toThrow(/清单|大小|版本/);
    expect((await readdir(dir)).some((file) => file.includes(".partial-"))).toBe(false);
  });
});
