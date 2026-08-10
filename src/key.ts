import { chmod, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { generateIdentity, identityToRecipient } from "age-encryption";
import { GitVaultyError } from "./errors.js";
import { ensureParent } from "./repository.js";

export interface StoredIdentity { identity: string; recipient: string }

export function identityFile(
  environment: NodeJS.ProcessEnv = process.env,
  homeDirectory = os.homedir(),
  platform = process.platform,
): string {
  const override = environment.GITVAULTY_AGE_KEY_FILE ?? environment.SOPS_AGE_KEY_FILE;
  if (override) return path.resolve(override);
  if (platform === "win32" && environment.APPDATA) return path.join(environment.APPDATA, "gitvaulty", "identity.txt");
  const config = environment.XDG_CONFIG_HOME ?? path.join(homeDirectory, ".config");
  return path.join(config, "gitvaulty", "identity.txt");
}

function cleanIdentity(value: string): string {
  const identity = value.split(/\r?\n/).map((line) => line.trim()).find((line) => line.startsWith("AGE-SECRET-KEY-"));
  if (!identity) throw new GitVaultyError("No valid native age private key was found.");
  return identity;
}

export async function readIdentity(file = identityFile()): Promise<string> {
  try { return cleanIdentity(await readFile(file, "utf8")); }
  catch (error) {
    if (error instanceof GitVaultyError) throw error;
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new GitVaultyError(`No GitVaulty key found at ${file}.`);
    throw error;
  }
}

export async function restoreIdentity(value: string, file = identityFile(), replace = false): Promise<StoredIdentity> {
  const identity = cleanIdentity(value);
  let recipient: string;
  try { recipient = await identityToRecipient(identity); }
  catch { throw new GitVaultyError("That is not a valid native age private key."); }
  await ensureParent(file);
  await writeFile(file, `# GitVaulty global identity\n${identity}\n`, { mode: 0o600, flag: replace ? "w" : "wx" }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "EEXIST") throw new GitVaultyError(`A GitVaulty key already exists at ${file}.`);
    throw error;
  });
  await chmod(file, 0o600);
  return { identity, recipient };
}

export async function createIdentity(file = identityFile()): Promise<StoredIdentity> {
  return restoreIdentity(await generateIdentity(), file);
}

export async function currentRecipient(file = identityFile()): Promise<string> {
  return identityToRecipient(await readIdentity(file));
}
