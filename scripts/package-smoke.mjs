import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const temporary = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-package-smoke-"));
const executable = path.join(temporary, "gitvaulty.js");

try {
  await symlink(path.resolve("dist/cli.js"), executable);
  const version = spawnSync(process.execPath, [executable, "--version"], { encoding: "utf8" });
  assert.equal(version.status, 0, version.stderr);
  assert.equal(version.stdout.trim(), manifest.version);

  const help = spawnSync(process.execPath, [executable, "--help"], { encoding: "utf8" });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Git-backed secrets for humans/);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
