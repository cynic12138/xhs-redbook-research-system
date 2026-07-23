import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  startReplyWorker: vi.fn(),
  stopReplyWorker: vi.fn(async () => undefined),
  prepareForShutdown: vi.fn(async () => undefined),
  resumeAfterCancelledShutdown: vi.fn(),
  resumeActiveJobs: vi.fn(async () => undefined),
  pauseActiveJobsOnStartup: vi.fn(async () => undefined),
  quiesceAiGoalRuns: vi.fn(async () => undefined),
  resumeAiGoalRunScheduling: vi.fn(),
  quiesceAiOrchestrations: vi.fn(async () => undefined),
  resumeAiOrchestrationScheduling: vi.fn(),
  quiesceApiMutations: vi.fn(async () => undefined),
  resumeApiMutations: vi.fn(),
  suspendRuntimeStorageAccess: vi.fn(),
  resumeRuntimeStorageAccess: vi.fn()
}));

vi.mock("../src/server/services/commentOps.js", () => ({
  startReplyWorker: runtime.startReplyWorker,
  stopReplyWorker: runtime.stopReplyWorker
}));
vi.mock("../src/server/services/jobService.js", () => ({
  jobs: {
    prepareForShutdown: runtime.prepareForShutdown,
    resumeAfterCancelledShutdown: runtime.resumeAfterCancelledShutdown,
    resumeActiveJobs: runtime.resumeActiveJobs,
    pauseActiveJobsOnStartup: runtime.pauseActiveJobsOnStartup
  }
}));
vi.mock("../src/server/services/aiGoalService.js", () => ({
  quiesceAiGoalRuns: runtime.quiesceAiGoalRuns,
  resumeAiGoalRunScheduling: runtime.resumeAiGoalRunScheduling
}));
vi.mock("../src/server/services/aiOrchestratorService.js", () => ({
  quiesceAiOrchestrations: runtime.quiesceAiOrchestrations,
  resumeAiOrchestrationScheduling: runtime.resumeAiOrchestrationScheduling
}));
vi.mock("../src/server/runtime/apiMutationActivity.js", () => ({
  quiesceApiMutations: runtime.quiesceApiMutations,
  resumeApiMutations: runtime.resumeApiMutations
}));
vi.mock("../src/server/storage/runtimeStorage.js", () => ({
  suspendRuntimeStorageAccess: runtime.suspendRuntimeStorageAccess,
  resumeRuntimeStorageAccess: runtime.resumeRuntimeStorageAccess
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("application runtime restore cancellation", () => {
  it("restarts the reply worker when a post-freeze restore step is cancelled", async () => {
    const applicationRuntime = await import("../src/server/runtime/applicationRuntime.js");
    await applicationRuntime.activateApplicationRuntime({ resumeJobs: false });
    vi.clearAllMocks();

    await applicationRuntime.prepareApplicationRuntimeForDataRestore(1_000);
    expect(runtime.stopReplyWorker).toHaveBeenCalledOnce();
    expect(runtime.startReplyWorker).not.toHaveBeenCalled();

    applicationRuntime.resumeApplicationRuntimeAfterCancelledRestore();
    expect(runtime.startReplyWorker).toHaveBeenCalledOnce();
    expect(runtime.resumeAfterCancelledShutdown).toHaveBeenCalledOnce();
    expect(runtime.resumeRuntimeStorageAccess).toHaveBeenCalledOnce();
  });
});
