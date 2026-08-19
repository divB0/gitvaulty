import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { createRequire } from "node:module";
import { chmod, copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import archiver from "archiver";
import { build } from "esbuild";

import { runtimeFilename, runtimeTarget } from "./package-tools.mjs";
import { injectSeaBlob } from "./sea-tools.mjs";

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(runtimeRoot, "..");
const distribution = path.join(runtimeRoot, "dist");
const bundle = path.join(distribution, "runtime.cjs");
const runtimeRequire = createRequire(path.join(runtimeRoot, "package.json"));
const repositoryRequire = createRequire(path.join(repositoryRoot, "package.json"));
const { inject } = runtimeRequire("postject");

/**
 * @typedef {{ cwd?: string, capture?: boolean, input?: Uint8Array }} RunOptions
 */

/**
 * @param {string} command
 * @param {string[]} args
 * @param {RunOptions} [options]
 * @returns {Promise<{ stdout: Buffer, stderr: Buffer }>}
 */
function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: options.cwd ?? runtimeRoot, stdio: options.capture ? "pipe" : "inherit" });
    /** @type {Buffer[]} */
    const stdout = [];
    /** @type {Buffer[]} */
    const stderr = [];
    child.stdout?.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr?.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) });
      else reject(new Error(`${path.basename(command)} exited with code ${code ?? 1}.`));
    });
    if (options.input) child.stdin?.end(options.input);
  });
}

await mkdir(distribution, { recursive: true });
await build({
  entryPoints: [path.join(runtimeRoot, "src", "main.ts")],
  outfile: bundle,
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node22",
  sourcemap: false,
  minify: false,
});

if (!process.argv.includes("--bundle-only")) {
  const target = runtimeTarget(process.platform, process.arch);
  const requestedIndex = process.argv.indexOf("--target");
  const requested = requestedIndex >= 0 ? process.argv[requestedIndex + 1] : target;
  if (requested !== target) throw new Error(`Runtime ${requested} must be built on its native ${target} runner.`);

  const staging = path.join(distribution, target);
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  const runtimeName = process.platform === "win32" ? "gitvaulty-editor-runtime.exe" : "gitvaulty-editor-runtime";
  const sopsName = process.platform === "win32" ? "sops.exe" : "sops";
  const executable = path.join(staging, runtimeName);
  const blob = path.join(distribution, "runtime.blob");
  const seaConfig = path.join(distribution, "sea-config.json");
  await writeFile(seaConfig, JSON.stringify({ main: bundle, output: blob, disableExperimentalSEAWarning: true, useCodeCache: false }));
  await run(process.execPath, ["--experimental-sea-config", seaConfig]);
  await copyFile(process.execPath, executable);
  if (process.platform !== "win32") await chmod(executable, 0o755);
  if (process.platform === "darwin") await run("codesign", ["--remove-signature", executable]);

  await injectSeaBlob(inject, executable, await readFile(blob), process.platform);
  if (process.platform === "darwin") await run("codesign", ["--sign", "-", executable]);
  if (process.platform !== "win32") await chmod(executable, 0o755);

  const sopsPackage = `@clef-sh/sops-${target}`;
  const sopsRoot = path.dirname(repositoryRequire.resolve(`${sopsPackage}/package.json`));
  const sops = path.join(staging, sopsName);
  await copyFile(path.join(sopsRoot, "bin", sopsName), sops);
  await copyFile(path.join(sopsRoot, "LICENSE.sops"), path.join(staging, "LICENSE.sops"));
  await copyFile(path.join(repositoryRoot, "LICENSE"), path.join(staging, "LICENSE.gitvaulty"));
  if (process.platform !== "win32") await chmod(sops, 0o755);

  const ping = Buffer.from(JSON.stringify({ id: "smoke", protocolVersion: 1, method: "ping", params: {} }));
  const frame = Buffer.alloc(4 + ping.length);
  frame.writeUInt32BE(ping.length, 0);
  ping.copy(frame, 4);
  const smoke = await run(executable, [], { input: frame, capture: true });
  if (smoke.stdout.length < 5 || !smoke.stdout.toString("utf8").includes('"id":"smoke"')) throw new Error("Runtime smoke test failed.");

  const archivePath = path.join(distribution, runtimeFilename(target));
  await new Promise((resolve, reject) => {
    const output = createWriteStream(archivePath, { mode: 0o600 });
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", resolve);
    output.on("error", reject);
    archive.on("error", reject);
    archive.pipe(output);
    archive.file(executable, { name: runtimeName, mode: 0o755 });
    archive.file(sops, { name: sopsName, mode: 0o755 });
    archive.file(path.join(staging, "LICENSE.sops"), { name: "LICENSE.sops", mode: 0o644 });
    archive.file(path.join(staging, "LICENSE.gitvaulty"), { name: "LICENSE.gitvaulty", mode: 0o644 });
    void archive.finalize();
  });
}
