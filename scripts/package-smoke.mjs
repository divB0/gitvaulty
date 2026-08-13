import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
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

  if (process.platform !== "win32") {
    const inaccessibleParent = path.join(temporary, "inaccessible");
    const inaccessibleCwd = path.join(inaccessibleParent, "cwd");
    await mkdir(inaccessibleCwd, { recursive: true });
    const originalCwd = process.cwd();
    try {
      process.chdir(inaccessibleCwd);
      await chmod(inaccessibleParent, 0o000);
      const keyBackupHelp = spawnSync(
        process.execPath,
        [executable, "key", "backup", "--help"],
        { encoding: "utf8" },
      );
      assert.equal(keyBackupHelp.status, 0, keyBackupHelp.stderr);
      assert.match(keyBackupHelp.stdout, /Print the private key for backup/);
    } finally {
      process.chdir(originalCwd);
      await chmod(inaccessibleParent, 0o700);
    }
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
