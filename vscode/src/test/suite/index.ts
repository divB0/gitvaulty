import path from "node:path";
import { pathToFileURL } from "node:url";

export async function run(): Promise<void> {
  const test = await import(pathToFileURL(path.resolve(__dirname, "editor-host.mjs")).href) as {
    runEditorTest(): Promise<void>;
  };
  await test.runEditorTest();
}
