import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { stageSops } from "./stage-sops.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const platform = process.platform === "win32" ? "win32" : process.platform;
const architecture = process.arch === "x64" ? "x64" : process.arch === "arm64" ? "arm64" : process.arch;
const target = `${platform}-${architecture}`;
const supported = new Set(["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64", "win32-x64"]);
if (!supported.has(target)) throw new Error(`GitVaulty does not publish a VS Code package for ${target}.`);
await stageSops(target);

const command = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "vsce.cmd" : "vsce");
const output = path.join(root, `gitvaulty-${packageJson.version}-${target}.vsix`);
const result = spawnSync(command, ["package", "--target", target, "--out", output], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (result.error) throw result.error;
if (result.status !== 0) process.exitCode = result.status ?? 1;
