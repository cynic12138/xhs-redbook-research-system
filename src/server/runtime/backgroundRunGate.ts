export class BackgroundRunGate {
  private accepting = true;
  private readonly runs = new Map<string, Promise<unknown>>();

  constructor(private readonly blockedMessage: string) {}

  ensureAccepting(): void {
    if (!this.accepting) throw new Error(this.blockedMessage);
  }

  has(id: string): boolean {
    return this.runs.has(id);
  }

  track(id: string, run: Promise<unknown>): void {
    this.ensureAccepting();
    this.runs.set(id, run);
    void run.then(
      () => this.runs.delete(id),
      () => this.runs.delete(id)
    );
  }

  async quiesce(timeoutMs: number): Promise<void> {
    this.accepting = false;
    const active = [...this.runs.values()];
    if (!active.length) return;
    await withTimeout(Promise.allSettled(active).then(() => undefined), timeoutMs, this.blockedMessage);
  }

  resume(): void {
    this.accepting = true;
  }
}

async function withTimeout(task: Promise<void>, timeoutMs: number, message: string): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      task,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${message} 请等待当前任务结束后重试。`)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
