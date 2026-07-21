import { logBackgroundError, startApplicationServer } from "./application.js";

process.on("unhandledRejection", (reason) => {
  logBackgroundError("unhandledRejection", reason);
});

process.on("uncaughtException", (error) => {
  logBackgroundError("uncaughtException", error);
});

void startApplicationServer()
  .then((running) => {
    console.log(`API listening on ${running.url}`);
  })
  .catch((error) => {
    logBackgroundError("serverStart", error);
    process.exitCode = 1;
  });
