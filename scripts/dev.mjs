import { spawn } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const healthUrl = "http://127.0.0.1:8787/api/health";
const children = new Set();
let stopping = false;
let startedServer = false;

main().catch((error) => {
  console.error(`[dev] ${error instanceof Error ? error.message : String(error)}`);
  stopAll(1);
});

async function main() {
  if (await isHealthy()) {
    console.log(`[dev] reusing healthy backend: ${healthUrl}`);
  } else {
    const server = start("server", ["run", "dev:server"]);
    children.add(server);
    startedServer = true;
    await waitForHealth(60000);
  }

  const client = start("client", ["run", "dev:client"]);
  children.add(client);

  process.on("SIGINT", () => stopAll(0));
  process.on("SIGTERM", () => stopAll(0));
}

function start(name, args) {
  const command = process.platform === "win32" ? `${npm} ${args.join(" ")}` : npm;
  const childArgs = process.platform === "win32" ? [] : args;
  const child = spawn(command, childArgs, { stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" });
  pipe(name, child.stdout);
  pipe(name, child.stderr);
  child.on("exit", (code, signal) => {
    children.delete(child);
    if (!stopping) {
      const exitCode = code ?? (signal ? 1 : 0);
      console.log(`[dev] ${name} exited with ${signal ?? exitCode}`);
      if (name === "server" || name === "client") {
        stopAll(exitCode);
      }
    }
  });
  return child;
}

function pipe(name, stream) {
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    for (const line of chunk.split(/\r?\n/)) {
      if (line) console.log(`[${name}] ${line}`);
    }
  });
}

async function waitForHealth(timeoutMs) {
  const startedAt = Date.now();
  console.log(`[dev] waiting for backend: ${healthUrl}`);
  while (Date.now() - startedAt < timeoutMs) {
    if (await isHealthy()) {
      console.log(`[dev] backend is ready: ${healthUrl}`);
      return;
    }
    await sleep(500);
  }
  throw new Error(`backend did not become healthy within ${Math.round(timeoutMs / 1000)}s`);
}

async function isHealthy() {
  try {
    const response = await fetch(healthUrl);
    return response.ok;
  } catch {
    return false;
  }
}

function stopAll(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    child.kill("SIGTERM");
  }
  if (!startedServer && children.size === 0) {
    process.exit(code);
  }
  setTimeout(() => process.exit(code), 300).unref();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
