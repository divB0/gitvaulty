import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Repository } from "./repository.js";
import { ensureParent } from "./repository.js";
import { GitVaultyError } from "./errors.js";
import { normalizeUsername, parseRecipient } from "./recipient.js";

export interface GitVaultyUser { username: string; recipient: string; files: string[] }
export interface Registry { version: 2; users: GitVaultyUser[] }

export function normalizeSecretFile(value: string): string {
  if (typeof value !== "string" || value.includes("\0")) throw new GitVaultyError("Invalid encrypted file path.");
  const portable = value.replaceAll("\\", "/");
  const segments = portable.split("/");
  if (
    portable.length <= ".gitvaulty".length
    || !portable.endsWith(".gitvaulty")
    || path.posix.isAbsolute(portable)
    || /^[a-zA-Z]:\//.test(portable)
    || segments.some((segment) => segment === "" || segment === "." || segment === "..")
    || segments[0] === ".git"
    || segments[0] === ".gitvaulty"
  ) throw new GitVaultyError("Invalid encrypted file path.");
  return portable;
}

export function normalizeGitVaultyUser(user: GitVaultyUser): GitVaultyUser {
  if (!user || typeof user !== "object" || !Array.isArray(user.files) || user.files.some((file) => typeof file !== "string")) {
    throw new GitVaultyError("Invalid user entry.");
  }
  return {
    username: normalizeUsername(user.username),
    recipient: parseRecipient(user.recipient),
    files: [...new Set(user.files.map(normalizeSecretFile))].sort(),
  };
}

function normalizeRegistry(value: unknown): Registry {
  if (!value || typeof value !== "object" || (value as Registry).version !== 2 || !Array.isArray((value as Registry).users)) {
    throw new GitVaultyError("Unsupported recipient registry format.");
  }
  let users: GitVaultyUser[];
  try { users = (value as Registry).users.map(normalizeGitVaultyUser); }
  catch { throw new GitVaultyError("Unsupported recipient registry format."); }
  const usernames = new Set(users.map((user) => user.username));
  const recipients = new Set(users.map((user) => user.recipient));
  if (usernames.size !== users.length || recipients.size !== users.length) throw new GitVaultyError("Duplicate username or recipient.");
  users.sort((left, right) => left.username.localeCompare(right.username));
  return { version: 2, users };
}

export async function readRegistry(repo: Repository): Promise<Registry> {
  let value: unknown;
  try { value = JSON.parse(await readFile(repo.registryFile, "utf8")); }
  catch { throw new GitVaultyError("The GitVaulty recipient registry is missing or invalid."); }
  return normalizeRegistry(value);
}

export function recipientsFor(registry: Registry, file: string): string[] {
  const normalized = normalizeSecretFile(file);
  return [...new Set(registry.users.filter((user) => user.files.includes(normalized)).map((user) => user.recipient))].sort();
}

function regexEscape(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function sopsConfig(registry: Registry): string {
  const files = [...new Set(registry.users.flatMap((user) => user.files))].sort();
  const creation_rules = files.map((file) => ({ path_regex: `^${regexEscape(file)}$`, age: recipientsFor(registry, file).join(",") }));
  return `${JSON.stringify({ creation_rules }, null, 2)}\n`;
}

async function atomicWrite(file: string, data: string): Promise<void> {
  await ensureParent(file);
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  await writeFile(temporary, data, { mode: 0o600 });
  await rename(temporary, file);
}

export async function writeRegistry(repo: Repository, registry: Registry): Promise<void> {
  const normalized = normalizeRegistry(registry);
  registry.users = normalized.users;
  await atomicWrite(repo.registryFile, `${JSON.stringify(normalized, null, 2)}\n`);
  await atomicWrite(repo.sopsConfigFile, sopsConfig(normalized));
}
