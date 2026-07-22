import { startReplyWorker, stopReplyWorker } from "../services/commentOps.js";
import { jobs } from "../services/jobService.js";
import { quiesceAiGoalRuns, resumeAiGoalRunScheduling } from "../services/aiGoalService.js";
import { quiesceAiOrchestrations, resumeAiOrchestrationScheduling } from "../services/aiOrchestratorService.js";
import { quiesceApiMutations, resumeApiMutations } from "./apiMutationActivity.js";
import { resumeRuntimeStorageAccess, suspendRuntimeStorageAccess } from "../storage/runtimeStorage.js";

let active = false;
let activation: Promise<void> | undefined;

export async function activateApplicationRuntime(options: { resumeJobs?: boolean } = {}): Promise<void> {
  resumeApplicationRuntimeAfterCancelledRestore();
  if (active) return;
  if (activation) return activation;

  activation = (async () => {
    if (options.resumeJobs) {
      await jobs.resumeActiveJobs();
    } else {
      await jobs.pauseActiveJobsOnStartup();
    }
    startReplyWorker();
    active = true;
  })();

  try {
    await activation;
  } finally {
    activation = undefined;
  }
}

export async function deactivateApplicationRuntime(): Promise<void> {
  if (activation) await activation;
  await prepareApplicationRuntimeForDataRestore(15_000);
  active = false;
}

export async function prepareApplicationRuntimeForDataRestore(timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + Math.max(0, timeoutMs);
  try {
    await quiesceApiMutations(remainingTime(deadline));
    await Promise.all([
      quiesceAiGoalRuns(remainingTime(deadline)),
      quiesceAiOrchestrations(remainingTime(deadline))
    ]);
    await stopReplyWorker(remainingTime(deadline));
    await jobs.prepareForShutdown(remainingTime(deadline));
    suspendRuntimeStorageAccess();
  } catch (error) {
    resumeApplicationRuntimeAfterCancelledRestore();
    throw error;
  }
}

export function resumeApplicationRuntimeAfterCancelledRestore(): void {
  resumeApiMutations();
  resumeAiGoalRunScheduling();
  resumeAiOrchestrationScheduling();
  resumeRuntimeStorageAccess();
  jobs.resumeAfterCancelledShutdown();
  if (active) startReplyWorker();
}

function remainingTime(deadline: number): number {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new Error("等待后台任务停止超时，请稍后重试数据恢复。");
  return remaining;
}
