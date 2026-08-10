import { chmod, readFile, writeFile } from "node:fs/promises";
import { generateIdentity, identityToRecipient } from "age-encryption";
import type { Repository } from "./repository.js";
import { ensureParent } from "./repository.js";
import { GitVaultyError } from "./errors.js";

function cleanIdentity(value: string): string {
  const identity = value.split(/\r?\n/).map((line) => line.trim()).find((line) => line.startsWith("AGE-SECRET-KEY-"));
  if (!identity) throw new GitVaultyError("No valid age private key was found.");
  return identity;
}

export async function readIdentity(repo: Repository): Promise<string> {
  try { return cleanIdentity(await readFile(repo.keyFile, "utf8")); }
  catch (error) {
    if (error instanceof GitVaultyError) throw error;
    throw new GitVaultyError("No local key found. Run `gitvaulty key generate` or `gitvaulty key import`.");
  }
}

async function storeIdentity(repo: Repository, value: string): Promise<{ identity: string; recipient: string }> {
  const identity = cleanIdentity(value);
  let recipient: string;
  try { recipient = await identityToRecipient(identity); }
  catch { throw new GitVaultyError("That is not a valid native age private key."); }
  await ensureParent(repo.keyFile);
  await writeFile(repo.keyFile, `# GitVaulty repository identity\n${identity}\n`, { mode: 0o600, flag: "wx" }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "EEXIST") throw new GitVaultyError("A local key already exists for this repository.");
    throw error;
  });
  await chmod(repo.keyFile, 0o600);
  return { identity, recipient };
}

export async function generateKey(repo: Repository): Promise<{ identity: string; recipient: string }> {
  return storeIdentity(repo, await generateIdentity());
}

export async function importKey(repo: Repository, identity: string): Promise<{ identity: string; recipient: string }> {
  return storeIdentity(repo, identity);
}

export async function currentRecipient(repo: Repository): Promise<string> { return identityToRecipient(await readIdentity(repo)); }

