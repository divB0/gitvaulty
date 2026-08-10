import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Repository } from "./repository.js";
import { ensureParent, validateName } from "./repository.js";
import { GitVaultyError } from "./errors.js";
import { normalizeUsername, parseRecipient } from "./recipient.js";

export interface VaultUser { username: string; recipient: string; vaults: string[] }
export interface Registry { version: 1; users: VaultUser[] }

export function normalizeVaultUser(user: VaultUser): VaultUser {
  if (!user || typeof user !== "object" || !Array.isArray(user.vaults) || user.vaults.some((vault) => typeof vault !== "string")) {
    throw new GitVaultyError("Invalid user entry.");
  }
  return {
    username: normalizeUsername(user.username),
    recipient: parseRecipient(user.recipient),
    vaults: [...new Set(user.vaults.map(validateName))].sort(),
  };
}

function normalizeRegistry(value: unknown): Registry {
  if (!value || typeof value !== "object" || (value as Registry).version !== 1 || !Array.isArray((value as Registry).users)) {
    throw new GitVaultyError("Unsupported recipient registry format.");
  }
  let users: VaultUser[];
  try { users = (value as Registry).users.map(normalizeVaultUser); }
  catch { throw new GitVaultyError("Unsupported recipient registry format."); }
  const usernames = new Set(users.map((user) => user.username));
  const recipients = new Set(users.map((user) => user.recipient));
  if (usernames.size !== users.length || recipients.size !== users.length) throw new GitVaultyError("Duplicate username or recipient.");
  users.sort((a, b) => a.username.localeCompare(b.username));
  return { version: 1, users };
}

export async function readRegistry(repo: Repository): Promise<Registry> {
  let value: unknown;
  try { value = JSON.parse(await readFile(repo.registryFile, "utf8")); }
  catch { throw new GitVaultyError("The GitVaulty recipient registry is missing or invalid."); }
  return normalizeRegistry(value);
}

export function recipientsFor(registry: Registry, vault: string): string[] {
  return [...new Set(registry.users.filter((user) => user.vaults.includes(vault)).map((user) => user.recipient))].sort();
}

function sopsConfig(registry: Registry): string {
  const vaults = [...new Set(registry.users.flatMap((user) => user.vaults))].sort();
  const creation_rules = vaults.map((vault) => ({ path_regex: `^vaults/${vault.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/vault\\.sops\\.json$`, age: recipientsFor(registry, vault).join(",") }));
  return `${JSON.stringify({ creation_rules }, null, 2)}\n`;
}

async function atomicWrite(file: string, data: string): Promise<void> {
  await ensureParent(file);
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  await writeFile(temp, data, { mode: 0o600 });
  await rename(temp, file);
}

export async function writeRegistry(repo: Repository, registry: Registry): Promise<void> {
  const normalized = normalizeRegistry(registry);
  registry.users = normalized.users;
  await atomicWrite(repo.registryFile, `${JSON.stringify(normalized, null, 2)}\n`);
  await atomicWrite(repo.sopsConfigFile, sopsConfig(normalized));
}
