import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const NUGET_URL = "https://dist.nuget.org/win-x86-commandline/v7.6.0/nuget.exe";
const NUGET_SHA256 = "751EE5E79481626A428C1241DC7F94BCA2739B32588E669715BC5FB54D8FB8A2";
const projectRoot = path.resolve(import.meta.dirname, "..");
const sourceVendor = path.join(projectRoot, "node_modules", "electron-winstaller", "vendor");
const sourceNuget = path.join(sourceVendor, "nuget.exe");
const preparedVendor = path.join(projectRoot, ".cache", "squirrel-vendor");
const preparedNuget = path.join(preparedVendor, "nuget.exe");
const temporaryNuget = `${preparedNuget}.download`;

await mkdir(preparedVendor, { recursive: true });
await cp(sourceVendor, preparedVendor, {
  recursive: true,
  force: true,
  filter: (source) => source !== sourceNuget
});

if (await fileHash(preparedNuget) !== NUGET_SHA256) {
  const response = await fetch(NUGET_URL);
  if (!response.ok) {
    throw new Error(`NuGet build tool download failed with HTTP ${response.status}.`);
  }
  const downloaded = Buffer.from(await response.arrayBuffer());
  if (hash(downloaded) !== NUGET_SHA256) {
    throw new Error("NuGet build tool checksum verification failed.");
  }
  await writeFile(temporaryNuget, downloaded);
  await rm(preparedNuget, { force: true });
  await rename(temporaryNuget, preparedNuget);
}

console.log("SQUIRREL_VENDOR_READY=true");

async function fileHash(file) {
  try {
    return hash(await readFile(file));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return "";
    throw error;
  }
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}
