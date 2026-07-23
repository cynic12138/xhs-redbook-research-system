import type { NextFunction, Request, RequestHandler, Response } from "express";

let acceptingMutations = true;
let activeMutations = 0;
const idleWaiters = new Set<() => void>();

export function createApiMutationActivityMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!shouldTrackRequest(req)) {
      next();
      return;
    }
    if (!acceptingMutations) {
      res.status(409).json({ error: "应用正在准备数据恢复，暂不接受新的修改请求。" });
      return;
    }
    activeMutations += 1;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      activeMutations = Math.max(0, activeMutations - 1);
      if (activeMutations === 0) {
        for (const resolve of idleWaiters) resolve();
        idleWaiters.clear();
      }
    };
    res.once("finish", finish);
    res.once("close", finish);
    next();
  };
}

function shouldTrackRequest(req: Request): boolean {
  if (!req.path.startsWith("/api/") || req.method === "OPTIONS") return false;
  if (req.method === "GET" && /^\/api\/ai\/(?:goal-runs|orchestrations)\/[^/]+\/events$/.test(req.path)) {
    return false;
  }
  return true;
}

export async function quiesceApiMutations(timeoutMs: number): Promise<void> {
  acceptingMutations = false;
  if (activeMutations === 0) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let resolveIdle!: () => void;
  const idle = new Promise<void>((resolve) => {
    resolveIdle = resolve;
    idleWaiters.add(resolve);
  });
  try {
    await Promise.race([
      idle,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("仍有数据修改正在执行，请等待完成后重试恢复。")), timeoutMs);
      })
    ]);
  } finally {
    idleWaiters.delete(resolveIdle);
    if (timer) clearTimeout(timer);
  }
}

export function resumeApiMutations(): void {
  acceptingMutations = true;
}
