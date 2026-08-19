import { createRequire } from "node:module";
import path from "node:path";
import type { Repository } from "./repository.js";
import { executeBinaryChecked, executeChecked } from "./process.js";
import { GitVaultyError } from "./errors.js";
import { currentIdentity, identityFile } from "./key.js";

export function resolveSops(): string {
  const platform = process.platform === "win32" ? "win32" : process.platform;
  const arch = process.arch === "x64" ? "x64" : process.arch === "arm64" ? "arm64" : process.arch;
  const name = `@clef-sh/sops-${platform}-${arch}`;
  try { return createRequire(import.meta.url).resolve(name); }
  catch { throw new GitVaultyError(`SOPS is unavailable for ${platform}-${arch}. Install sops and set GITVAULTY_SOPS, or open an issue.`); }
}

async function sopsEnvironment(): Promise<NodeJS.ProcessEnv> {
  const result = { ...process.env };
  const identity = await currentIdentity(identityFile(result), result);
  delete result.GITVAULTY_KEY;
  result.SOPS_AGE_KEY = identity.ageIdentity;
  delete result.SOPS_AGE_KEY_FILE;
  return result;
}

function executable(): string { return process.env.GITVAULTY_SOPS ?? resolveSops(); }

export async function encryptSecretFile(
  repo: Repository,
  relativeFile: string,
  plaintext: Buffer,
  recipients: string[],
): Promise<Buffer> {
  if (recipients.length === 0) throw new GitVaultyError("An encrypted file needs at least one recipient.");
  const result = await executeBinaryChecked(executable(), [
    "encrypt", "--age", recipients.join(","), "--input-type", "binary", "--output-type", "binary",
    "--filename-override", relativeFile,
  ], { cwd: repo.root, env: await sopsEnvironment(), input: plaintext });
  return result.stdout;
}

export async function decryptSecretFile(repo: Repository, file: string): Promise<Buffer> {
  return (await executeBinaryChecked(executable(), [
    "decrypt", "--input-type", "binary", "--output-type", "binary", file,
  ], { cwd: repo.root, env: await sopsEnvironment() })).stdout;
}

export async function updateSecretFileKeys(repo: Repository, file: string): Promise<void> {
  await executeChecked(executable(), [
    "updatekeys", "--yes", "--input-type", "binary", path.relative(repo.root, file),
  ], { cwd: repo.root, env: await sopsEnvironment() });
}

export async function rotateSecretFileKey(repo: Repository, file: string, removedRecipient: string): Promise<void> {
  await executeChecked(executable(), [
    "rotate", "--in-place", "--input-type", "binary", "--output-type", "binary",
    "--rm-age", removedRecipient, path.relative(repo.root, file),
  ], { cwd: repo.root, env: await sopsEnvironment() });
}
