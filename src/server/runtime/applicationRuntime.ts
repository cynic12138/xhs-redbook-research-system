import { startReplyWorker, stopReplyWorker } from "../services/commentOps.js";
import { jobs } from "../services/jobService.js";

let active = false;
let activation: Promise<void> | undefined;

export async function activateApplicationRuntime(options: { resumeJobs?: boolean } = {}): Promise<void> {
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
  await stopReplyWorker();
  active = false;
}
