import { spawn } from "node:child_process";
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

interface DemoResult {
  code: number | null;
  stderr: string;
}

async function writeExecutable(file: string, contents: string): Promise<void> {
  await writeFile(file, contents, { mode: 0o755 });
}

async function createFakeWorkspace(parent: string, name: string): Promise<string> {
  const root = path.join(parent, name);
  const scripts = path.join(root, "scripts");
  const demos = path.join(root, "demos");
  const bin = path.join(root, "bin");
  await Promise.all([
    mkdir(scripts, { recursive: true }),
    mkdir(demos, { recursive: true }),
    mkdir(bin, { recursive: true }),
  ]);

  await copyFile(
    path.join(repositoryRoot, "scripts", "generate-demo.sh"),
    path.join(scripts, "generate-demo.sh"),
  );

  const successCommand = "#!/bin/sh\nexit 0\n";
  await Promise.all([
    writeExecutable(path.join(bin, "git"), successCommand),
    writeExecutable(path.join(bin, "node"), successCommand),
    writeExecutable(path.join(bin, "npm"), successCommand),
    writeExecutable(path.join(bin, "terraform"), successCommand),
    writeExecutable(path.join(bin, "vhs"), `#!/bin/sh
set -eu
: "\${DEMO_DIR:?}"
: "\${DEMO_KEYS:?}"
: "\${DEMO_REMOTE:?}"
printf '%s\n%s\n%s\n' "$DEMO_DIR" "$DEMO_KEYS" "$DEMO_REMOTE" > demos/runtime-paths.txt
sleep 0.2
printf 'GIF89a' > demos/access-control.gif
`),
  ]);

  return root;
}

async function runDemo(root: string, temporaryRoot: string): Promise<DemoResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn("bash", [path.join(root, "scripts", "generate-demo.sh")], {
      cwd: root,
      env: {
        ...process.env,
        PATH: `${path.join(root, "bin")}:${process.env.PATH ?? ""}`,
        GITVAULTY_DEMO_TMPDIR: temporaryRoot,
      },
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => { resolve({ code, stderr }); });
  });
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

describe("demo generation", () => {
  it("isolates and cleans up concurrent worktree runtimes", { timeout: 15_000 }, async () => {
    const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-demo-test-"));
    const temporaryRoot = path.join(fixtureRoot, "tmp");
    await mkdir(temporaryRoot);

    try {
      const first = await createFakeWorkspace(fixtureRoot, "first");
      const second = await createFakeWorkspace(fixtureRoot, "second");
      const results = await Promise.all([
        runDemo(first, temporaryRoot),
        runDemo(second, temporaryRoot),
      ]);

      expect(results).toEqual([
        { code: 0, stderr: "" },
        { code: 0, stderr: "" },
      ]);

      const paths = await Promise.all([first, second].map(async (root) => {
        expect(await readFile(path.join(root, "demos", "access-control.gif"), "utf8"))
          .toBe("GIF89a");
        const [demoDir, keysDir, remote] = (await readFile(
          path.join(root, "demos", "runtime-paths.txt"),
          "utf8",
        )).trim().split("\n");
        expect(demoDir).toBeDefined();
        expect(keysDir).toBeDefined();
        expect(remote).toBeDefined();
        const runtimeRoot = path.dirname(demoDir!);
        expect(keysDir).toBe(path.join(runtimeRoot, "keys"));
        expect(remote).toBe(path.join(runtimeRoot, "remote.git"));
        return runtimeRoot;
      }));

      expect(paths[0]).not.toBe(paths[1]);
      await Promise.all(paths.map(async (runtimeRoot) => {
        expect(path.dirname(runtimeRoot)).toBe(temporaryRoot);
        expect(await exists(runtimeRoot)).toBe(false);
      }));
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });
});
