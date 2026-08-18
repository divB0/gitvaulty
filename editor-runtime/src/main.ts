import { runBridge } from "./bridge.js";

void runBridge().catch(() => {
  process.stderr.write("GitVaulty editor runtime stopped because of a protocol or I/O error.\n");
  process.exitCode = 1;
});
