import path from "node:path";
import { access, mkdir } from "node:fs/promises";
import { executeChecked } from "./process.js";
import { GitVaultyError } from "./errors.js";

export interface Repository {
  root: string;
  configFile: string;
  registryFile: string;
  sopsConfigFile: string;
  excludeFile: string;
}

async function gitPath(cwd: string, ...args: string[]): Promise<string> {
  try { return (await executeChecked("git", args, { cwd })).stdout.trim(); }
  catch { throw new GitVaultyError("Current directory is not inside a Git repository."); }
}

export function normalizeGitPath(value: string, platformPath: Pick<typeof path, "resolve"> = path): string {
  return platformPath.resolve(value);
}

export async function findRepository(cwd = process.cwd()): Promise<Repository> {
  const root = normalizeGitPath(await gitPath(cwd, "rev-parse", "--show-toplevel"));
  const excludeRaw = await gitPath(cwd, "rev-parse", "--git-path", "info/exclude");
  return {
    root,
    configFile: path.join(root, ".gitvaulty", "config.yaml"),
    registryFile: path.join(root, ".gitvaulty", "recipients.json"),
    sopsConfigFile: path.join(root, ".sops.yaml"),
    excludeFile: path.resolve(root, excludeRaw),
  };
}

export async function ensureInitialized(repo: Repository): Promise<void> {
  try { await access(repo.registryFile); }
  catch { throw new GitVaultyError("GitVaulty is not initialized. Run `gitvaulty init` first."); }
}

export async function ensureParent(file: string): Promise<void> { await mkdir(path.dirname(file), { recursive: true }); }
