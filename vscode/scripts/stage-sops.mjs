import { chmod, copyFile, mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const supported = new Set(["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64", "win32-x64"]);

export async function stageSops(target) {
  if (!supported.has(target)) throw new Error(`GitVaulty does not publish a VS Code package for ${target}.`);
  const packageName = `@clef-sh/sops-${target}`;
  let packageRoot;
  try { packageRoot = path.dirname(require.resolve(`${packageName}/package.json`)); }
  catch { throw new Error(`${packageName} is not installed. Package this target on a matching native runner.`); }

  const executableName = target.startsWith("win32-") ? "sops.exe" : "sops";
  const output = path.join(extensionRoot, "bin");
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await copyFile(path.join(packageRoot, "bin", executableName), path.join(output, executableName));
  await copyFile(path.join(packageRoot, "LICENSE.sops"), path.join(output, "LICENSE.sops"));
  if (process.platform !== "win32") await chmod(path.join(output, executableName), 0o755);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) throw new Error("Pass a VS Code target such as darwin-arm64.");
  await stageSops(target);
}
