import path from "node:path";
import { createHash } from "node:crypto";
import {
  access,
  chmod,
  lstat,
  readFile,
  rename,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import spawn from "cross-spawn";
import type { Repository } from "./repository.js";
import { ensureInitialized, ensureParent, findRepository } from "./repository.js";
import { currentRecipient, readIdentity } from "./key.js";
import {
  type GitVaultyUser,
  type SecretFileGrant,
  type Registry,
  filesForUser,
  normalizeFileGrant,
  normalizeGroupName,
  normalizeGitVaultyUser,
  normalizeRegistry,
  normalizeSecretFile,
  readRegistry,
  recipientsFor,
  usernamesFor,
  writeRegistry,
} from "./registry.js";
import {
  decryptSecretFile,
  encryptSecretFile,
} from "./sops.js";
import { execute, executeChecked } from "./process.js";
import { GitVaultyError, TrackedPlaintextError } from "./errors.js";
import { normalizeUsername } from "./recipient.js";
import { createEditTempSession } from "./edit-temp.js";

function portable(file: string): string { return file.split(path.sep).join("/"); }

function insideRepository(repo: Repository, requested: string): { absolute: string; relative: string } {
  const absolute = path.resolve(repo.root, requested);
  if (absolute === repo.root || !absolute.startsWith(`${repo.root}${path.sep}`)) {
    throw new GitVaultyError(`File must be inside the repository: ${requested}`);
  }
  const relative = portable(path.relative(repo.root, absolute));
  if (
    relative === ".git"
    || relative.startsWith(".git/")
    || relative === ".gitvaulty"
    || relative.startsWith(".gitvaulty/")
  ) throw new GitVaultyError(`File must be outside GitVaulty's internal directories: ${requested}`);
  return { absolute, relative };
}

async function assertNoSymlinkComponents(repo: Repository, absolute: string, includeLeaf: boolean): Promise<void> {
  const relative = path.relative(repo.root, absolute);
  const segments = relative.split(path.sep);
  const limit = includeLeaf ? segments.length : segments.length - 1;
  let current = repo.root;
  for (let index = 0; index < limit; index += 1) {
    current = path.join(current, segments[index]!);
    try {
      if ((await lstat(current)).isSymbolicLink()) throw new GitVaultyError(`File path contains a symbolic link: ${portable(relative)}`);
    } catch (error: unknown) {
      if (error instanceof GitVaultyError) throw error;
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
  }
}

export function encryptedFileFor(repo: Repository, plaintextFile: string): string {
  const source = insideRepository(repo, plaintextFile);
  if (source.relative.endsWith(".gitvaulty")) throw new GitVaultyError(`Use the plaintext path, without .gitvaulty: ${plaintextFile}`);
  const encrypted = normalizeSecretFile(`${source.relative}.gitvaulty`);
  return path.join(repo.root, ...encrypted.split("/"));
}

export function plaintextFileFor(repo: Repository, encryptedFile: string): string {
  const source = insideRepository(repo, encryptedFile);
  const normalized = normalizeSecretFile(source.relative);
  return path.join(repo.root, ...normalized.slice(0, -".gitvaulty".length).split("/"));
}

function logicalRelative(repo: Repository, plaintextFile: string): string {
  const source = insideRepository(repo, plaintextFile);
  if (source.relative.endsWith(".gitvaulty")) throw new GitVaultyError(`Use the plaintext path, without .gitvaulty: ${plaintextFile}`);
  normalizeSecretFile(`${source.relative}.gitvaulty`);
  return source.relative;
}

function encryptedRelative(repo: Repository, plaintextFile: string): string {
  return normalizeSecretFile(`${logicalRelative(repo, plaintextFile)}.gitvaulty`);
}

async function registeredLocalUser(registry: Registry): Promise<GitVaultyUser> {
  const recipient = await currentRecipient();
  const user = registry.users.find((candidate) => candidate.recipient === recipient);
  if (!user) throw new GitVaultyError("Your global age key is not registered. Ask an existing user to add its public recipient.");
  return user;
}

async function isTracked(repo: Repository, relative: string): Promise<boolean> {
  return (await execute("git", ["ls-files", "--error-unmatch", "--", relative], { cwd: repo.root })).code === 0;
}

async function exclude(repo: Repository, output: string): Promise<void> {
  await ensureParent(repo.excludeFile);
  let lines: string[] = [];
  try { lines = (await readFile(repo.excludeFile, "utf8")).split(/\r?\n/); }
  catch { /* new Git repository */ }
  const relative = `/${portable(path.relative(repo.root, output))}`;
  if (!lines.includes(relative)) {
    await writeFile(repo.excludeFile, `${lines.filter(Boolean).join("\n")}${lines.some(Boolean) ? "\n" : ""}${relative}\n`);
  }
}

async function fileExists(file: string): Promise<boolean> {
  try { await access(file); return true; }
  catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function atomicWrite(file: string, data: Buffer, mode = 0o600): Promise<void> {
  await ensureParent(file);
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  try {
    await writeFile(temporary, data, { mode, flag: "wx" });
    await rename(temporary, file);
    await chmod(file, mode);
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function initialize(repo: Repository, user: { username: string; recipient: string }): Promise<void> {
  if (await fileExists(repo.registryFile)) throw new GitVaultyError("GitVaulty is already initialized.");
  const owner = normalizeGitVaultyUser(user);
  await writeRegistry(repo, {
    version: 3,
    defaultGroup: "team",
    users: [owner],
    groups: [{ name: "team", members: [owner.username] }],
    files: [],
  });
}

export interface FileAccess { groups?: string[]; users?: string[] }

function requestedAccess(registry: Registry, access: FileAccess = {}): Pick<SecretFileGrant, "groups" | "users"> {
  const explicit = (access.groups?.length ?? 0) > 0 || (access.users?.length ?? 0) > 0;
  const normalized = normalizeFileGrant({
    path: "placeholder.gitvaulty",
    groups: explicit ? access.groups ?? [] : [registry.defaultGroup],
    users: access.users ?? [],
  });
  return { groups: normalized.groups, users: normalized.users };
}

async function registerEncryptedFile(repo: Repository, encrypted: string, plaintext: Buffer, access: FileAccess = {}): Promise<void> {
  const registry = await readRegistry(repo);
  const original = structuredClone(registry);
  const user = await registeredLocalUser(registry);
  if (registry.files.some((candidate) => candidate.path === encrypted)) {
    throw new GitVaultyError(`Encrypted file already exists in the registry: ${encrypted}`);
  }
  registry.files.push({ path: encrypted, ...requestedAccess(registry, access) });
  const normalized = normalizeRegistry(registry);
  if (!usernamesFor(normalized, encrypted).includes(user.username)) {
    throw new GitVaultyError("Your user must have access to a file when creating or importing it.");
  }
  const encryptedAbsolute = path.join(repo.root, ...encrypted.split("/"));
  try {
    await writeRegistry(repo, registry);
    const ciphertext = await encryptSecretFile(repo, encrypted, plaintext, recipientsFor(registry, encrypted));
    await assertNoSymlinkComponents(repo, encryptedAbsolute, false);
    await ensureParent(encryptedAbsolute);
    await writeFile(encryptedAbsolute, ciphertext, { mode: 0o600, flag: "wx" });
    const decrypted = await decryptSecretFile(repo, encryptedAbsolute);
    if (!decrypted.equals(plaintext)) throw new GitVaultyError(`Encrypted verification failed for ${encrypted}.`);
  } catch (error) {
    await rm(encryptedAbsolute, { force: true });
    await writeRegistry(repo, original);
    throw error;
  }
}

async function replaceEncryptedFile(
  repo: Repository,
  encrypted: string,
  encryptedAbsolute: string,
  plaintext: Buffer,
): Promise<void> {
  const registry = await readRegistry(repo);
  const ciphertext = await encryptSecretFile(repo, encrypted, plaintext, recipientsFor(registry, encrypted));
  await ensureParent(encryptedAbsolute);
  const temporary = path.join(
    path.dirname(encryptedAbsolute),
    `.${path.basename(encryptedAbsolute)}.${process.pid}.${Date.now()}.tmp`,
  );
  try {
    await writeFile(temporary, ciphertext, { mode: 0o600, flag: "wx" });
    if (!(await decryptSecretFile(repo, temporary)).equals(plaintext)) {
      throw new GitVaultyError(`Encrypted verification failed for ${encrypted}.`);
    }
    await rename(temporary, encryptedAbsolute);
    await chmod(encryptedAbsolute, 0o600);
  } finally {
    await rm(temporary, { force: true });
  }
}

export interface CreatedSecretFile { file: string }

export async function createSecretFile(repo: Repository, plaintextFile: string, access: FileAccess = {}): Promise<CreatedSecretFile> {
  await ensureInitialized(repo);
  const logical = logicalRelative(repo, plaintextFile);
  const plaintextAbsolute = path.join(repo.root, ...logical.split("/"));
  const encrypted = `${logical}.gitvaulty`;
  const encryptedAbsolute = path.join(repo.root, ...encrypted.split("/"));
  await assertNoSymlinkComponents(repo, plaintextAbsolute, true);
  await assertNoSymlinkComponents(repo, encryptedAbsolute, true);
  if (await fileExists(plaintextAbsolute)) throw new GitVaultyError(`Plaintext file already exists; use \`gitvaulty import ${logical}\` instead.`);
  if (await fileExists(encryptedAbsolute)) throw new GitVaultyError(`Encrypted file already exists: ${encrypted}`);
  await registerEncryptedFile(repo, encrypted, Buffer.alloc(0), access);
  await exclude(repo, plaintextAbsolute);
  return { file: logical };
}

export interface ImportedSecretFile { file: string; bytes: number }

export async function stopTrackingPlaintext(repo: Repository, plaintextFile: string): Promise<string> {
  await ensureInitialized(repo);
  const logical = logicalRelative(repo, plaintextFile);
  const plaintextAbsolute = path.join(repo.root, ...logical.split("/"));
  await exclude(repo, plaintextAbsolute);
  await executeChecked("git", ["rm", "--cached", "--", logical], { cwd: repo.root });
  return logical;
}

export async function importSecretFile(repo: Repository, plaintextFile: string, access: FileAccess = {}): Promise<ImportedSecretFile> {
  await ensureInitialized(repo);
  const logical = logicalRelative(repo, plaintextFile);
  const plaintextAbsolute = path.join(repo.root, ...logical.split("/"));
  const encrypted = `${logical}.gitvaulty`;
  const encryptedAbsolute = path.join(repo.root, ...encrypted.split("/"));
  await assertNoSymlinkComponents(repo, plaintextAbsolute, true);
  await assertNoSymlinkComponents(repo, encryptedAbsolute, true);
  let stats;
  try { stats = await lstat(plaintextAbsolute); }
  catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new GitVaultyError(`Plaintext file does not exist: ${logical}`);
    throw error;
  }
  if (!stats.isFile() || stats.isSymbolicLink()) throw new GitVaultyError(`Plaintext source must be a regular file: ${logical}`);
  if (await fileExists(encryptedAbsolute)) throw new GitVaultyError(`Encrypted file already exists: ${encrypted}`);
  if (await isTracked(repo, logical)) throw new TrackedPlaintextError(logical);
  const plaintext = await readFile(plaintextAbsolute);
  await registerEncryptedFile(repo, encrypted, plaintext, access);
  await exclude(repo, plaintextAbsolute);
  await chmod(plaintextAbsolute, 0o600);
  return { file: logical, bytes: plaintext.length };
}

export async function updateSecretFile(repo: Repository, plaintextFile: string): Promise<ImportedSecretFile> {
  const file = await authorizedFile(repo, plaintextFile);
  const plaintextAbsolute = path.join(repo.root, ...file.logical.split("/"));
  await assertNoSymlinkComponents(repo, plaintextAbsolute, true);
  let stats;
  try { stats = await lstat(plaintextAbsolute); }
  catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new GitVaultyError(`Plaintext file does not exist: ${file.logical}`);
    throw error;
  }
  if (!stats.isFile() || stats.isSymbolicLink()) throw new GitVaultyError(`Plaintext source must be a regular file: ${file.logical}`);
  if (await isTracked(repo, file.logical)) throw new TrackedPlaintextError(file.logical);
  const plaintext = await readFile(plaintextAbsolute);
  await replaceEncryptedFile(repo, file.encrypted, file.encryptedAbsolute, plaintext);
  await exclude(repo, plaintextAbsolute);
  await chmod(plaintextAbsolute, 0o600);
  return { file: file.logical, bytes: plaintext.length };
}

function editorCommand(environment: NodeJS.ProcessEnv): { command: string; args: string[] } {
  const configured = environment.VISUAL ?? environment.EDITOR ?? (process.platform === "win32" ? "notepad" : "vi");
  const parts = configured.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map((part) => {
    if ((part.startsWith('"') && part.endsWith('"')) || (part.startsWith("'") && part.endsWith("'"))) return part.slice(1, -1);
    return part;
  }) ?? [];
  const [command, ...args] = parts;
  if (!command) throw new GitVaultyError("VISUAL or EDITOR must name an editor.");
  return { command, args };
}

async function authorizedFile(repo: Repository, plaintextFile: string): Promise<{ logical: string; encrypted: string; encryptedAbsolute: string }> {
  await ensureInitialized(repo);
  const logical = logicalRelative(repo, plaintextFile);
  const encrypted = `${logical}.gitvaulty`;
  const registry = await readRegistry(repo);
  const user = await registeredLocalUser(registry);
  if (!filesForUser(registry, user.username).includes(encrypted)) throw new GitVaultyError(`Your key is not authorized for ${logical}.`);
  const encryptedAbsolute = path.join(repo.root, ...encrypted.split("/"));
  await assertNoSymlinkComponents(repo, encryptedAbsolute, true);
  const stats = await lstat(encryptedAbsolute).catch(() => { throw new GitVaultyError(`Encrypted file does not exist: ${encrypted}`); });
  if (!stats.isFile() || stats.isSymbolicLink()) throw new GitVaultyError(`Encrypted source must be a regular file: ${encrypted}`);
  return { logical, encrypted, encryptedAbsolute };
}

export type EditConflictResolution = "error" | "use-local" | "discard-local";

export async function editSecretFile(
  repo: Repository,
  plaintextFile: string,
  conflictResolution: EditConflictResolution = "error",
): Promise<boolean> {
  const file = await authorizedFile(repo, plaintextFile);
  let original = await decryptSecretFile(repo, file.encryptedAbsolute);
  const plaintextAbsolute = path.join(repo.root, ...file.logical.split("/"));
  await assertNoSymlinkComponents(repo, plaintextAbsolute, true);
  let updateMaterialized = false;
  if (await fileExists(plaintextAbsolute)) {
    const stats = await lstat(plaintextAbsolute);
    if (!stats.isFile() || stats.isSymbolicLink()) throw new GitVaultyError(`Plaintext destination is unsafe: ${file.logical}`);
    if (await isTracked(repo, file.logical)) throw new GitVaultyError(`Git-tracked plaintext cannot be edited safely: ${file.logical}`);
    const local = await readFile(plaintextAbsolute);
    if (!local.equals(original)) {
      if (conflictResolution === "error") throw new GitVaultyError(`${file.logical} has local changes.`);
      if (conflictResolution === "use-local") {
        await replaceEncryptedFile(repo, file.encrypted, file.encryptedAbsolute, local);
        original = local;
      } else await atomicWrite(plaintextAbsolute, original);
    }
    updateMaterialized = true;
  }

  const session = await createEditTempSession(path.basename(file.logical));
  try {
    await writeFile(session.file, original, { mode: 0o600 });
    const editor = editorCommand(process.env);
    await executeChecked(editor.command, [...editor.args, session.file], { cwd: repo.root, env: process.env, inherit: true });
    const updated = await readFile(session.file);
    if (updated.equals(original)) return false;
    await replaceEncryptedFile(repo, file.encrypted, file.encryptedAbsolute, updated);
    if (updateMaterialized) await atomicWrite(plaintextAbsolute, updated);
    return true;
  } finally {
    await session.close();
  }
}

export interface NewUser extends GitVaultyUser { groups?: string[] }

function sameValues(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

async function mutateAccess(repo: Repository, mutate: (registry: Registry) => void): Promise<void> {
  await ensureInitialized(repo);
  const original = await readRegistry(repo);
  const next = structuredClone(original);
  mutate(next);
  const normalized = normalizeRegistry(next);
  const paths = [...new Set([...original.files.map((file) => file.path), ...normalized.files.map((file) => file.path)])].sort();
  const changed = paths.filter((file) => !sameValues(recipientsFor(original, file), recipientsFor(normalized, file)));
  const local = await registeredLocalUser(original);
  if (!normalized.users.some((user) => user.recipient === local.recipient)) {
    throw new GitVaultyError("You cannot remove your own user.");
  }
  for (const file of changed) {
    if (original.files.some((candidate) => candidate.path === file) && !usernamesFor(normalized, file).includes(local.username)) {
      throw new GitVaultyError(`You cannot remove your own access from ${file.slice(0, -".gitvaulty".length)}.`);
    }
  }

  const snapshots = new Map<string, Buffer>();
  const plaintext = new Map<string, Buffer>();
  for (const file of changed) {
    if (!original.files.some((candidate) => candidate.path === file)) continue;
    const absolute = path.join(repo.root, ...file.split("/"));
    snapshots.set(file, await readFile(absolute));
    plaintext.set(file, await decryptSecretFile(repo, absolute));
  }
  try {
    await writeRegistry(repo, normalized);
    for (const [file, contents] of plaintext) {
      await replaceEncryptedFile(repo, file, path.join(repo.root, ...file.split("/")), contents);
    }
  } catch (error) {
    for (const [file, contents] of snapshots) await atomicWrite(path.join(repo.root, ...file.split("/")), contents);
    await writeRegistry(repo, original);
    throw error;
  }
}

export async function addUser(repo: Repository, user: NewUser): Promise<void> {
  const added = normalizeGitVaultyUser(user);
  await mutateAccess(repo, (registry) => {
    if (registry.users.some((item) => item.username === added.username || item.recipient === added.recipient)) {
      throw new GitVaultyError("That username or recipient already exists.");
    }
    const groups = (user.groups?.length ? user.groups : [registry.defaultGroup]).map(normalizeGroupName);
    for (const name of groups) if (!registry.groups.some((group) => group.name === name)) throw new GitVaultyError(`Unknown group: ${name}`);
    registry.users.push(added);
    for (const group of registry.groups) if (groups.includes(group.name)) group.members.push(added.username);
  });
}

export async function removeUser(repo: Repository, username: string): Promise<void> {
  const normalized = normalizeUsername(username);
  const existing = await readRegistry(repo);
  const removed = existing.users.find((user) => user.username === normalized);
  if (!removed) throw new GitVaultyError(`Unknown user: ${normalized}`);
  if (removed.recipient === await currentRecipient()) throw new GitVaultyError("You cannot remove your own user.");
  await mutateAccess(repo, (registry) => {
    registry.users = registry.users.filter((item) => item.username !== normalized);
    for (const group of registry.groups) group.members = group.members.filter((member) => member !== normalized);
    for (const file of registry.files) file.users = file.users.filter((member) => member !== normalized);
  });
}

export async function createGroup(repo: Repository, name: string): Promise<void> {
  const normalized = normalizeGroupName(name);
  await mutateAccess(repo, (registry) => {
    if (registry.groups.some((group) => group.name === normalized)) throw new GitVaultyError(`Group already exists: ${normalized}`);
    registry.groups.push({ name: normalized, members: [] });
  });
}

export async function deleteGroup(repo: Repository, name: string): Promise<void> {
  const normalized = normalizeGroupName(name);
  await mutateAccess(repo, (registry) => {
    if (registry.defaultGroup === normalized) throw new GitVaultyError(`Cannot delete the default group: ${normalized}`);
    if (!registry.groups.some((group) => group.name === normalized)) throw new GitVaultyError(`Unknown group: ${normalized}`);
    const usedBy = registry.files.filter((file) => file.groups.includes(normalized)).map((file) => file.path);
    if (usedBy.length > 0) throw new GitVaultyError(`Group ${normalized} is still used by: ${usedBy.join(", ")}`);
    registry.groups = registry.groups.filter((group) => group.name !== normalized);
  });
}

export async function addGroupMember(repo: Repository, name: string, username: string): Promise<void> {
  const groupName = normalizeGroupName(name);
  const member = normalizeUsername(username);
  await mutateAccess(repo, (registry) => {
    const group = registry.groups.find((candidate) => candidate.name === groupName);
    if (!group) throw new GitVaultyError(`Unknown group: ${groupName}`);
    if (!registry.users.some((user) => user.username === member)) throw new GitVaultyError(`Unknown user: ${member}`);
    if (group.members.includes(member)) throw new GitVaultyError(`${member} is already in ${groupName}.`);
    group.members.push(member);
  });
}

export async function removeGroupMember(repo: Repository, name: string, username: string): Promise<void> {
  const groupName = normalizeGroupName(name);
  const member = normalizeUsername(username);
  await mutateAccess(repo, (registry) => {
    const group = registry.groups.find((candidate) => candidate.name === groupName);
    if (!group) throw new GitVaultyError(`Unknown group: ${groupName}`);
    if (!group.members.includes(member)) throw new GitVaultyError(`${member} is not in ${groupName}.`);
    group.members = group.members.filter((candidate) => candidate !== member);
  });
}

export async function setFileAccess(repo: Repository, plaintextFile: string, access: Required<FileAccess>): Promise<SecretFileGrant> {
  const encrypted = encryptedRelative(repo, plaintextFile);
  await mutateAccess(repo, (registry) => {
    const index = registry.files.findIndex((file) => file.path === encrypted);
    if (index < 0) throw new GitVaultyError(`Unknown encrypted file: ${encrypted}`);
    registry.files[index] = normalizeFileGrant({ path: encrypted, groups: access.groups, users: access.users });
  });
  return (await readRegistry(repo)).files.find((file) => file.path === encrypted)!;
}

export type FileState = "missing" | "current" | "modified" | "tracked" | "unsafe";
export interface SecretFileStatus { file: string; encryptedFile: string; state: FileState }

interface PreparedFile extends SecretFileStatus {
  outputAbsolute: string;
  encryptedAbsolute: string;
  plaintext: Buffer;
}

function digest(value: Buffer): string { return createHash("sha256").update(value).digest("hex"); }

async function selectedEncryptedFiles(repo: Repository, plaintextFiles: string[]): Promise<string[]> {
  const registry = await readRegistry(repo);
  const user = await registeredLocalUser(registry);
  const accessible = filesForUser(registry, user.username);
  if (plaintextFiles.length === 0) return accessible;
  const selected = plaintextFiles.map((file) => encryptedRelative(repo, file));
  const unique = [...new Set(selected)];
  if (unique.length !== selected.length) throw new GitVaultyError("A file was selected more than once.");
  for (const file of unique) if (!accessible.includes(file)) throw new GitVaultyError(`Your key is not authorized for ${file.slice(0, -".gitvaulty".length)}.`);
  return unique;
}

async function prepareFiles(repo: Repository, plaintextFiles: string[]): Promise<PreparedFile[]> {
  await ensureInitialized(repo);
  const encryptedFiles = await selectedEncryptedFiles(repo, plaintextFiles);
  if (encryptedFiles.length === 0) throw new GitVaultyError("There are no accessible encrypted files.");
  const prepared: PreparedFile[] = [];
  for (const encryptedFile of encryptedFiles) {
    const file = encryptedFile.slice(0, -".gitvaulty".length);
    const encryptedAbsolute = path.join(repo.root, ...encryptedFile.split("/"));
    const outputAbsolute = path.join(repo.root, ...file.split("/"));
    await assertNoSymlinkComponents(repo, encryptedAbsolute, true);
    await assertNoSymlinkComponents(repo, outputAbsolute, false);
    const encryptedStats = await lstat(encryptedAbsolute).catch(() => { throw new GitVaultyError(`Encrypted file does not exist: ${encryptedFile}`); });
    if (!encryptedStats.isFile() || encryptedStats.isSymbolicLink()) throw new GitVaultyError(`Encrypted source must be a regular file: ${encryptedFile}`);
    const plaintext = await decryptSecretFile(repo, encryptedAbsolute);
    let state: FileState = "missing";
    if (await isTracked(repo, file)) state = "tracked";
    else {
      try {
        const stats = await lstat(outputAbsolute);
        if (!stats.isFile() || stats.isSymbolicLink()) state = "unsafe";
        else state = (await readFile(outputAbsolute)).equals(plaintext) ? "current" : "modified";
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    prepared.push({ file, encryptedFile, state, outputAbsolute, encryptedAbsolute, plaintext });
  }
  return prepared;
}

export async function statusSecretFiles(repo: Repository, plaintextFiles: string[] = []): Promise<SecretFileStatus[]> {
  return (await prepareFiles(repo, plaintextFiles)).map(({ file, encryptedFile, state }) => ({ file, encryptedFile, state }));
}

function assertMaterializable(files: PreparedFile[]): void {
  const blocked = files.find((file) => file.state === "modified" || file.state === "tracked" || file.state === "unsafe");
  if (blocked) throw new GitVaultyError(`${blocked.file} is ${blocked.state}; GitVaulty did not overwrite it.`);
}

interface OwnedOutput { file: string; outputAbsolute: string; digest: string }

async function writeMissing(repo: Repository, files: PreparedFile[]): Promise<OwnedOutput[]> {
  assertMaterializable(files);
  const owned: OwnedOutput[] = [];
  try {
    for (const file of files) {
      if (file.state === "current") {
        await chmod(file.outputAbsolute, 0o600);
        continue;
      }
      await ensureParent(file.outputAbsolute);
      await assertNoSymlinkComponents(repo, file.outputAbsolute, false);
      await writeFile(file.outputAbsolute, file.plaintext, { mode: 0o600, flag: "wx" }).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "EEXIST") throw new GitVaultyError(`Plaintext destination appeared while materializing: ${file.file}`);
        throw error;
      });
      await chmod(file.outputAbsolute, 0o600);
      owned.push({ file: file.file, outputAbsolute: file.outputAbsolute, digest: digest(file.plaintext) });
    }
    return owned;
  } catch (error) {
    await cleanupOwned(owned);
    throw error;
  }
}

async function cleanupOwned(outputs: OwnedOutput[]): Promise<string[]> {
  const retained: string[] = [];
  for (const output of outputs) {
    try {
      const stats = await lstat(output.outputAbsolute);
      if (!stats.isFile() || stats.isSymbolicLink() || digest(await readFile(output.outputAbsolute)) !== output.digest) {
        retained.push(output.file);
      } else await unlink(output.outputAbsolute);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") retained.push(output.file);
    }
  }
  return retained;
}

export async function materializeSecretFiles(repo: Repository, plaintextFiles: string[] = []): Promise<string[]> {
  const prepared = await prepareFiles(repo, plaintextFiles);
  const created = await writeMissing(repo, prepared);
  for (const file of prepared) await exclude(repo, file.outputAbsolute);
  return created.map((file) => file.file);
}

export interface CleanResult { removed: string[]; retained: SecretFileStatus[] }

export async function cleanSecretFiles(repo: Repository, plaintextFiles: string[] = []): Promise<CleanResult> {
  const prepared = await prepareFiles(repo, plaintextFiles);
  const removed: string[] = [];
  const retained: SecretFileStatus[] = [];
  for (const file of prepared) {
    if (file.state === "current") {
      await unlink(file.outputAbsolute);
      removed.push(file.file);
    } else if (file.state !== "missing") retained.push({ file: file.file, encryptedFile: file.encryptedFile, state: file.state });
  }
  return { removed, retained };
}

interface ChildOutcome { code: number; signal: NodeJS.Signals | null }

async function runChild(repo: Repository, command: string[]): Promise<ChildOutcome> {
  const [program, ...args] = command;
  if (!program) throw new GitVaultyError("Pass a command after `--`.");
  const childEnvironment = { ...process.env };
  for (const key of ["GITVAULTY_KEY", "SOPS_AGE_KEY", "GITVAULTY_AGE_KEY_FILE", "SOPS_AGE_KEY_FILE", "SOPS_AGE_KEY_CMD"]) {
    delete childEnvironment[key];
  }
  const child = spawn(program, args, { cwd: repo.root, env: childEnvironment, stdio: "inherit" });
  const signals: NodeJS.Signals[] = ["SIGHUP", "SIGINT", "SIGTERM"];
  const handlers = new Map<NodeJS.Signals, () => void>();
  for (const signal of signals) {
    const handler = (): void => { child.kill(signal); };
    handlers.set(signal, handler);
    process.on(signal, handler);
  }
  try {
    return await new Promise((resolve, reject) => {
      child.on("error", reject);
      child.on("exit", (code, signal) => resolve({ code: code ?? 1, signal }));
    });
  } finally {
    for (const [signal, handler] of handlers) process.off(signal, handler);
  }
}

export interface RunResult { code: number; retained: string[] }

export async function runWithFiles(repo: Repository, plaintextFiles: string[], command: string[]): Promise<RunResult> {
  if (command.length === 0) throw new GitVaultyError("Pass a command after `--`.");
  const prepared = await prepareFiles(repo, plaintextFiles);
  const owned = await writeMissing(repo, prepared);
  for (const file of prepared) await exclude(repo, file.outputAbsolute);
  let outcome: ChildOutcome;
  try { outcome = await runChild(repo, command); }
  catch (error) {
    await cleanupOwned(owned);
    throw error;
  }
  const retained = await cleanupOwned(owned);
  if (outcome.signal) {
    process.kill(process.pid, outcome.signal);
    return { code: 1, retained };
  }
  return { code: outcome.code, retained };
}

export { findRepository, readIdentity };
