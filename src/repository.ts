import path from "node:path";
import { access, mkdir } from "node:fs/promises";
import { executeChecked } from "./process.js";
import { GitVaultyError } from "./errors.js";

export interface Repository {
  root: string;
  registryFile: string;
  sopsConfigFile: string;
  vaultsDir: string;
  excludeFile: string;
}

async function gitPath(cwd: string, ...args: string[]): Promise<string> {
  try { return (await executeChecked("git", args, { cwd })).stdout.trim(); }
  catch { throw new GitVaultyError("Run this command inside a Git repository."); }
}

export async function findRepository(cwd = process.cwd()): Promise<Repository> {
  const root = await gitPath(cwd, "rev-parse", "--show-toplevel");
  const excludeRaw = await gitPath(cwd, "rev-parse", "--git-path", "info/exclude");
  return {
    root,
    registryFile: path.join(root, ".gitvaulty", "recipients.json"),
    sopsConfigFile: path.join(root, ".sops.yaml"),
    vaultsDir: path.join(root, "vaults"),
    excludeFile: path.resolve(root, excludeRaw),
  };
}

export async function ensureInitialized(repo: Repository): Promise<void> {
  try { await access(repo.registryFile); }
  catch { throw new GitVaultyError("GitVaulty is not initialized. Run `gitvaulty init` first."); }
}

export function validateName(name: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name)) throw new GitVaultyError(`Invalid vault name: ${name}`);
  return name;
}

export async function ensureParent(file: string): Promise<void> { await mkdir(path.dirname(file), { recursive: true }); }
