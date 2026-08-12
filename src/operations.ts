import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import {
  access,
  chmod,
  lstat,
  mkdtemp,
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
  type Registry,
  normalizeGitVaultyUser,
  normalizeSecretFile,
  readRegistry,
  recipientsFor,
  writeRegistry,
} from "./registry.js";
import {
  decryptSecretFile,
  encryptSecretFile,
  rotateSecretFileKey,
  updateSecretFileKeys,
} from "./sops.js";
import { execute, executeChecked } from "./process.js";
import { GitVaultyError } from "./errors.js";

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
  await writeRegistry(repo, { version: 2, users: [{ ...user, files: [] }] });
}

async function registerEncryptedFile(repo: Repository, encrypted: string, plaintext: Buffer): Promise<void> {
  const registry = await readRegistry(repo);
  const original = structuredClone(registry);
  const user = await registeredLocalUser(registry);
  if (registry.users.some((candidate) => candidate.files.includes(encrypted))) {
    throw new GitVaultyError(`Encrypted file already exists in the registry: ${encrypted}`);
  }
  user.files.push(encrypted);
  await writeRegistry(repo, registry);
  const encryptedAbsolute = path.join(repo.root, ...encrypted.split("/"));
  try {
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

export async function createSecretFile(repo: Repository, plaintextFile: string): Promise<CreatedSecretFile> {
  await ensureInitialized(repo);
  const logical = logicalRelative(repo, plaintextFile);
  const plaintextAbsolute = path.join(repo.root, ...logical.split("/"));
  const encrypted = `${logical}.gitvaulty`;
  const encryptedAbsolute = path.join(repo.root, ...encrypted.split("/"));
  await assertNoSymlinkComponents(repo, plaintextAbsolute, true);
  await assertNoSymlinkComponents(repo, encryptedAbsolute, true);
  if (await fileExists(plaintextAbsolute)) throw new GitVaultyError(`Plaintext file already exists; use \`gitvaulty import ${logical}\` instead.`);
  if (await fileExists(encryptedAbsolute)) throw new GitVaultyError(`Encrypted file already exists: ${encrypted}`);
  await registerEncryptedFile(repo, encrypted, Buffer.alloc(0));
  await exclude(repo, plaintextAbsolute);
  return { file: logical };
}

export interface ImportedSecretFile { file: string; bytes: number }

export async function importSecretFile(repo: Repository, plaintextFile: string): Promise<ImportedSecretFile> {
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
  if (await isTracked(repo, logical)) throw new GitVaultyError(`Git-tracked plaintext cannot be imported safely: ${logical}`);
  if (await fileExists(encryptedAbsolute)) throw new GitVaultyError(`Encrypted file already exists: ${encrypted}`);
  const plaintext = await readFile(plaintextAbsolute);
  await registerEncryptedFile(repo, encrypted, plaintext);
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
  if (await isTracked(repo, file.logical)) throw new GitVaultyError(`Git-tracked plaintext cannot be imported safely: ${file.logical}`);
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
  if (!user.files.includes(encrypted)) throw new GitVaultyError(`Your key is not authorized for ${logical}.`);
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

  const directory = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-edit-"));
  await chmod(directory, 0o700);
  const temporary = path.join(directory, path.basename(file.logical));
  try {
    await writeFile(temporary, original, { mode: 0o600 });
    const editor = editorCommand(process.env);
    await executeChecked(editor.command, [...editor.args, temporary], { cwd: repo.root, env: process.env, inherit: true });
    const updated = await readFile(temporary);
    if (updated.equals(original)) return false;
    await replaceEncryptedFile(repo, file.encrypted, file.encryptedAbsolute, updated);
    if (updateMaterialized) await atomicWrite(plaintextAbsolute, updated);
    return true;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function addUser(repo: Repository, user: GitVaultyUser): Promise<void> {
  await ensureInitialized(repo);
  const registry = await readRegistry(repo);
  const added = normalizeGitVaultyUser(user);
  if (registry.users.some((item) => item.username === added.username || item.recipient === added.recipient)) {
    throw new GitVaultyError("That username or recipient already exists.");
  }
  const known = new Set(registry.users.flatMap((item) => item.files));
  for (const file of added.files) if (!known.has(file)) throw new GitVaultyError(`Unknown encrypted file: ${file}`);
  const snapshots = new Map<string, Buffer>();
  for (const file of added.files) snapshots.set(file, await readFile(path.join(repo.root, ...file.split("/"))));
  registry.users.push(added);
  await writeRegistry(repo, registry);
  try {
    for (const file of added.files) await updateSecretFileKeys(repo, path.join(repo.root, ...file.split("/")));
  } catch (error) {
    for (const [file, contents] of snapshots) await writeFile(path.join(repo.root, ...file.split("/")), contents);
    registry.users = registry.users.filter((item) => item.username !== added.username);
    await writeRegistry(repo, registry);
    throw error;
  }
}

export async function removeUser(repo: Repository, username: string): Promise<void> {
  await ensureInitialized(repo);
  const registry = await readRegistry(repo);
  const user = registry.users.find((item) => item.username === username);
  if (!user) throw new GitVaultyError(`Unknown user: ${username}`);
  for (const file of user.files) {
    if (recipientsFor(registry, file).length < 2) throw new GitVaultyError(`Cannot remove the last recipient from ${file}.`);
  }
  const original = structuredClone(registry);
  const snapshots = new Map<string, Buffer>();
  for (const file of user.files) snapshots.set(file, await readFile(path.join(repo.root, ...file.split("/"))));
  registry.users = registry.users.filter((item) => item.username !== username);
  await writeRegistry(repo, registry);
  try {
    for (const file of user.files) await rotateSecretFileKey(repo, path.join(repo.root, ...file.split("/")), user.recipient);
  } catch (error) {
    for (const [file, contents] of snapshots) await writeFile(path.join(repo.root, ...file.split("/")), contents);
    await writeRegistry(repo, original);
    throw error;
  }
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
  if (plaintextFiles.length === 0) return [...user.files].sort();
  const selected = plaintextFiles.map((file) => encryptedRelative(repo, file));
  const unique = [...new Set(selected)];
  if (unique.length !== selected.length) throw new GitVaultyError("A file was selected more than once.");
  for (const file of unique) if (!user.files.includes(file)) throw new GitVaultyError(`Your key is not authorized for ${file.slice(0, -".gitvaulty".length)}.`);
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
