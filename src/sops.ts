import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Repository } from "./repository.js";
import { executeChecked } from "./process.js";
import { GitVaultyError } from "./errors.js";

const require = createRequire(import.meta.url);

export function resolveSops(): string {
  const platform = process.platform === "win32" ? "win32" : process.platform;
  const arch = process.arch === "x64" ? "x64" : process.arch === "arm64" ? "arm64" : process.arch;
  const name = `@clef-sh/sops-${platform}-${arch}`;
  try { return require.resolve(name); }
  catch { throw new GitVaultyError(`SOPS is unavailable for ${platform}-${arch}. Install sops and set GITVAULTY_SOPS, or open an issue.`); }
}

function env(repo: Repository): NodeJS.ProcessEnv {
  const result = { ...process.env };
  if (!result.SOPS_AGE_KEY_FILE && existsSync(repo.keyFile)) result.SOPS_AGE_KEY_FILE = repo.keyFile;
  return result;
}

export async function encryptVault(repo: Repository, relativeFile: string, plaintext: string, recipients: string[]): Promise<string> {
  if (recipients.length === 0) throw new GitVaultyError("A vault needs at least one recipient.");
  const result = await executeChecked(process.env.GITVAULTY_SOPS ?? resolveSops(), ["encrypt", "--age", recipients.join(","), "--input-type", "json", "--output-type", "json", "--filename-override", relativeFile], { cwd: repo.root, env: env(repo), input: plaintext });
  return result.stdout;
}

export async function decryptVault(repo: Repository, file: string): Promise<string> {
  return (await executeChecked(process.env.GITVAULTY_SOPS ?? resolveSops(), ["decrypt", "--input-type", "json", "--output-type", "json", file], { cwd: repo.root, env: env(repo) })).stdout;
}

export async function editVault(repo: Repository, file: string): Promise<void> {
  await executeChecked(process.env.GITVAULTY_SOPS ?? resolveSops(), [file], { cwd: repo.root, env: env(repo), inherit: true });
}

export async function updateVaultKeys(repo: Repository, file: string): Promise<void> {
  await executeChecked(process.env.GITVAULTY_SOPS ?? resolveSops(), ["updatekeys", "--yes", path.relative(repo.root, file)], { cwd: repo.root, env: env(repo) });
}

export async function rotateVaultKey(repo: Repository, file: string, removedRecipient: string): Promise<void> {
  await executeChecked(process.env.GITVAULTY_SOPS ?? resolveSops(), ["rotate", "--in-place", "--rm-age", removedRecipient, path.relative(repo.root, file)], { cwd: repo.root, env: env(repo) });
}
