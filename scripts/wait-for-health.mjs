const url = process.argv[2] ?? "http://127.0.0.1:8787/api/health";
const timeoutMs = Number(process.argv[3] ?? 60000);
const startedAt = Date.now();

console.log(`[wait] waiting for ${url}`);

while (Date.now() - startedAt < timeoutMs) {
  try {
    const response = await fetch(url);
    if (response.ok) {
      console.log(`[wait] backend is ready: ${url}`);
      process.exit(0);
    }
  } catch {
    // Server is still starting.
  }
  await sleep(500);
}

console.error(`[wait] timed out after ${Math.round(timeoutMs / 1000)}s: ${url}`);
process.exit(1);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
