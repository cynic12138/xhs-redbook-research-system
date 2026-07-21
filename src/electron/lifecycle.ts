export async function finishStartupFailure(
  closeServer: (() => Promise<void>) | undefined,
  quit: () => void
): Promise<void> {
  try {
    await closeServer?.();
  } catch {
    // The original startup error is already visible; a close failure must not leave a hidden process behind.
  } finally {
    quit();
  }
}
