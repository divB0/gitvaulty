import path from "node:path";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import spawn from "cross-spawn";
import type { Repository } from "./repository.js";
import { ensureInitialized, findRepository, validateName } from "./repository.js";
import { currentRecipient, readIdentity } from "./key.js";
import { type Registry, type VaultUser, normalizeVaultUser, readRegistry, recipientsFor, writeRegistry } from "./registry.js";
import { decryptVault, editVault, encryptVault, rotateVaultKey, updateVaultKeys } from "./sops.js";
import { ensureTemplateDirectory } from "./templates.js";
import { GitVaultyError } from "./errors.js";

export async function initialize(repo: Repository, user: { username: string; recipient: string }): Promise<void> {
  try { await access(repo.registryFile); throw new GitVaultyError("GitVaulty is already initialized."); }
  catch (error: unknown) { if (error instanceof GitVaultyError) throw error; if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  await writeRegistry(repo, { version: 1, users: [{ ...user, vaults: [] }] });
  await mkdir(repo.vaultsDir, { recursive: true });
}

export function vaultFile(repo: Repository, name: string): string { return path.join(repo.vaultsDir, validateName(name), "vault.sops.json"); }

async function registeredLocalUser(repo: Repository, registry: Registry): Promise<VaultUser> {
  const recipient = await currentRecipient();
  const user = registry.users.find((candidate) => candidate.recipient === recipient);
  if (!user) throw new GitVaultyError("Your global age key is not registered. Ask an existing user to add its public recipient.");
  return user;
}

export async function createVault(repo: Repository, name: string): Promise<void> {
  await ensureInitialized(repo);
  const file = vaultFile(repo, name);
  try { await access(file); throw new GitVaultyError(`Vault ${name} already exists.`); }
  catch (error: unknown) { if (error instanceof GitVaultyError) throw error; if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const registry = await readRegistry(repo);
  const user = await registeredLocalUser(repo, registry);
  user.vaults.push(name);
  await writeRegistry(repo, registry);
  try {
    await ensureTemplateDirectory(repo, name);
    const relative = path.relative(repo.root, file).split(path.sep).join("/");
    await writeFile(file, await encryptVault(repo, relative, `${JSON.stringify({ env: {} }, null, 2)}\n`, recipientsFor(registry, name)), { mode: 0o600 });
  } catch (error) {
    user.vaults = user.vaults.filter((vault) => vault !== name);
    await writeRegistry(repo, registry);
    await rm(path.dirname(file), { recursive: true, force: true });
    throw error;
  }
}

export async function edit(repo: Repository, name: string): Promise<void> { await ensureInitialized(repo); await editVault(repo, vaultFile(repo, name)); }

export async function addUser(repo: Repository, user: VaultUser): Promise<void> {
  await ensureInitialized(repo);
  const registry = await readRegistry(repo);
  const added = normalizeVaultUser(user);
  if (registry.users.some((item) => item.username === added.username || item.recipient === added.recipient)) throw new GitVaultyError("That username or recipient already exists.");
  const snapshots = new Map<string, string>();
  for (const vault of added.vaults) snapshots.set(vault, await readFile(vaultFile(repo, vault), "utf8"));
  registry.users.push(added);
  await writeRegistry(repo, registry);
  try { for (const vault of added.vaults) await updateVaultKeys(repo, vaultFile(repo, vault)); }
  catch (error) {
    for (const [vault, contents] of snapshots) await writeFile(vaultFile(repo, vault), contents);
    registry.users = registry.users.filter((item) => item.username !== added.username); await writeRegistry(repo, registry); throw error;
  }
}

export async function removeUser(repo: Repository, username: string): Promise<void> {
  await ensureInitialized(repo);
  const registry = await readRegistry(repo);
  const user = registry.users.find((item) => item.username === username);
  if (!user) throw new GitVaultyError(`Unknown user: ${username}`);
  for (const vault of user.vaults) if (recipientsFor(registry, vault).length < 2) throw new GitVaultyError(`Cannot remove the last recipient from vault ${vault}.`);
  const original = structuredClone(registry);
  const snapshots = new Map<string, string>();
  for (const vault of user.vaults) snapshots.set(vault, await readFile(vaultFile(repo, vault), "utf8"));
  registry.users = registry.users.filter((item) => item.username !== username);
  await writeRegistry(repo, registry);
  try { for (const vault of user.vaults) await rotateVaultKey(repo, vaultFile(repo, vault), user.recipient); }
  catch (error) { for (const [vault, contents] of snapshots) await writeFile(vaultFile(repo, vault), contents); await writeRegistry(repo, original); throw error; }
}

export async function vaultData(repo: Repository, name: string): Promise<Record<string, unknown>> {
  const value: unknown = JSON.parse(await decryptVault(repo, vaultFile(repo, name)));
  if (!value || typeof value !== "object") throw new GitVaultyError("Vault data must be a JSON object.");
  return value as Record<string, unknown>;
}

export async function runWithVault(repo: Repository, name: string, command: string[]): Promise<number> {
  if (command.length === 0) throw new GitVaultyError("Pass a command after `--`.");
  const data = await vaultData(repo, name);
  const source = data.env;
  if (!source || typeof source !== "object" || Array.isArray(source)) throw new GitVaultyError("Vault must contain a top-level env object.");
  const injected: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (!["string", "number", "boolean"].includes(typeof value)) throw new GitVaultyError(`env.${key} must be a string, number, or boolean.`);
    injected[key] = String(value);
  }
  return new Promise((resolve, reject) => {
    const [program, ...args] = command;
    const child = spawn(program!, args, { cwd: repo.root, env: { ...process.env, ...injected }, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) { process.kill(process.pid, signal); return; }
      resolve(code ?? 1);
    });
  });
}

export { findRepository, readIdentity };
