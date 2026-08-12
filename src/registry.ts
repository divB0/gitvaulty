import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Repository } from "./repository.js";
import { ensureParent } from "./repository.js";
import { GitVaultyError } from "./errors.js";
import { normalizeUsername, parseRecipient } from "./recipient.js";

export interface GitVaultyUser { username: string; recipient: string }
export interface GitVaultyGroup { name: string; members: string[] }
export interface SecretFileGrant { path: string; groups: string[]; users: string[] }
export interface Registry {
  version: 3;
  defaultGroup: string;
  users: GitVaultyUser[];
  groups: GitVaultyGroup[];
  files: SecretFileGrant[];
}

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

export function normalizeGroupName(input: string): string {
  try { return normalizeUsername(input); }
  catch { throw new GitVaultyError("Enter a group name using lowercase letters, numbers, '.', '_', or '-'."); }
}

export function normalizeGitVaultyUser(user: GitVaultyUser): GitVaultyUser {
  if (!user || typeof user !== "object") throw new GitVaultyError("Invalid user entry.");
  return { username: normalizeUsername(user.username), recipient: parseRecipient(user.recipient) };
}

export function normalizeGitVaultyGroup(group: GitVaultyGroup): GitVaultyGroup {
  if (!group || typeof group !== "object" || !Array.isArray(group.members) || group.members.some((member) => typeof member !== "string")) {
    throw new GitVaultyError("Invalid group entry.");
  }
  return {
    name: normalizeGroupName(group.name),
    members: [...new Set(group.members.map(normalizeUsername))].sort(),
  };
}

export function normalizeFileGrant(file: SecretFileGrant): SecretFileGrant {
  if (
    !file || typeof file !== "object"
    || !Array.isArray(file.groups) || file.groups.some((group) => typeof group !== "string")
    || !Array.isArray(file.users) || file.users.some((user) => typeof user !== "string")
  ) throw new GitVaultyError("Invalid file access entry.");
  return {
    path: normalizeSecretFile(file.path),
    groups: [...new Set(file.groups.map(normalizeGroupName))].sort(),
    users: [...new Set(file.users.map(normalizeUsername))].sort(),
  };
}

export function normalizeRegistry(value: unknown): Registry {
  if (
    !value || typeof value !== "object"
    || (value as Registry).version !== 3
    || typeof (value as Registry).defaultGroup !== "string"
    || !Array.isArray((value as Registry).users)
    || !Array.isArray((value as Registry).groups)
    || !Array.isArray((value as Registry).files)
  ) throw new GitVaultyError("Unsupported recipient registry format.");

  let defaultGroup: string;
  let users: GitVaultyUser[];
  let groups: GitVaultyGroup[];
  let files: SecretFileGrant[];
  try {
    defaultGroup = normalizeGroupName((value as Registry).defaultGroup);
    users = (value as Registry).users.map(normalizeGitVaultyUser);
    groups = (value as Registry).groups.map(normalizeGitVaultyGroup);
    files = (value as Registry).files.map(normalizeFileGrant);
  } catch (error) {
    if (error instanceof GitVaultyError) throw error;
    throw new GitVaultyError("Unsupported recipient registry format.");
  }

  const usernames = new Set(users.map((user) => user.username));
  const recipients = new Set(users.map((user) => user.recipient));
  if (usernames.size !== users.length || recipients.size !== users.length) throw new GitVaultyError("Duplicate username or recipient.");
  const groupNames = new Set(groups.map((group) => group.name));
  if (groupNames.size !== groups.length) throw new GitVaultyError("Duplicate group name.");
  const filePaths = new Set(files.map((file) => file.path));
  if (filePaths.size !== files.length) throw new GitVaultyError("Duplicate encrypted file path.");
  if (!groupNames.has(defaultGroup)) throw new GitVaultyError(`Unknown default group: ${defaultGroup}`);

  for (const group of groups) {
    for (const member of group.members) if (!usernames.has(member)) throw new GitVaultyError(`Unknown user in group ${group.name}: ${member}`);
  }
  for (const file of files) {
    for (const group of file.groups) if (!groupNames.has(group)) throw new GitVaultyError(`Unknown group for ${file.path}: ${group}`);
    for (const username of file.users) if (!usernames.has(username)) throw new GitVaultyError(`Unknown user for ${file.path}: ${username}`);
  }

  users.sort((left, right) => left.username.localeCompare(right.username));
  groups.sort((left, right) => left.name.localeCompare(right.name));
  files.sort((left, right) => left.path.localeCompare(right.path));
  const registry: Registry = { version: 3, defaultGroup, users, groups, files };
  for (const file of files) {
    if (recipientsFor(registry, file.path).length === 0) throw new GitVaultyError(`Encrypted file needs at least one recipient: ${file.path}`);
  }
  return registry;
}

export async function readRegistry(repo: Repository): Promise<Registry> {
  let value: unknown;
  try { value = JSON.parse(await readFile(repo.registryFile, "utf8")); }
  catch { throw new GitVaultyError("The GitVaulty recipient registry is missing or invalid."); }
  return normalizeRegistry(value);
}

export function fileGrantFor(registry: Registry, file: string): SecretFileGrant | undefined {
  const normalized = normalizeSecretFile(file);
  return registry.files.find((candidate) => candidate.path === normalized);
}

export function usernamesFor(registry: Registry, file: string): string[] {
  const grant = fileGrantFor(registry, file);
  if (!grant) return [];
  const usernames = new Set(grant.users);
  for (const groupName of grant.groups) {
    const group = registry.groups.find((candidate) => candidate.name === groupName);
    for (const member of group?.members ?? []) usernames.add(member);
  }
  return [...usernames].sort();
}

export function recipientsFor(registry: Registry, file: string): string[] {
  const recipients = usernamesFor(registry, file).map((username) => registry.users.find((user) => user.username === username)!.recipient);
  return [...new Set(recipients)].sort();
}

export function filesForUser(registry: Registry, username: string): string[] {
  const normalized = normalizeUsername(username);
  return registry.files.filter((file) => usernamesFor(registry, file.path).includes(normalized)).map((file) => file.path).sort();
}

function regexEscape(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function sopsConfig(registry: Registry): string {
  const creation_rules = registry.files.map((file) => ({
    path_regex: `^${regexEscape(file.path)}$`,
    age: recipientsFor(registry, file.path).join(","),
  }));
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
  Object.assign(registry, normalized);
  await atomicWrite(repo.registryFile, `${JSON.stringify(normalized, null, 2)}\n`);
  await atomicWrite(repo.sopsConfigFile, sopsConfig(normalized));
}
