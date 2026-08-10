import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Repository } from "./repository.js";
import { ensureParent, validateName } from "./repository.js";
import { GitVaultyError } from "./errors.js";

export interface VaultUser { id: string; recipient: string; vaults: string[] }
export interface Registry { version: 1; users: VaultUser[] }

export async function readRegistry(repo: Repository): Promise<Registry> {
  let value: unknown;
  try { value = JSON.parse(await readFile(repo.registryFile, "utf8")); }
  catch { throw new GitVaultyError("The GitVaulty recipient registry is missing or invalid."); }
  if (!value || typeof value !== "object" || (value as Registry).version !== 1 || !Array.isArray((value as Registry).users)) throw new GitVaultyError("Unsupported recipient registry format.");
  return value as Registry;
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
  registry.users.sort((a, b) => a.id.localeCompare(b.id));
  for (const user of registry.users) {
    user.vaults = [...new Set(user.vaults.map(validateName))].sort();
    if (!user.id.trim() || !/^age1[0-9a-z]+$/.test(user.recipient)) throw new GitVaultyError("Invalid user ID or native age recipient.");
  }
  await atomicWrite(repo.registryFile, `${JSON.stringify(registry, null, 2)}\n`);
  await atomicWrite(repo.sopsConfigFile, sopsConfig(registry));
}

