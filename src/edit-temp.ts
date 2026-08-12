import { randomBytes } from "node:crypto";
import {
  chmod,
  lstat,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import type { Stats } from "node:fs";
import { createServer, type Server } from "node:net";
import os from "node:os";
import path from "node:path";

const EDIT_DIRECTORY_PREFIX = "gitvaulty-edit-";
const EDIT_DIRECTORY_PATTERN = /^gitvaulty-edit-[A-Za-z0-9]{6}$/;
const LOCK_FILENAME = ".lock";
const LOCK_VERSION = 1;
const MAX_LOCK_BYTES = 1_024;

export const DEFAULT_EDIT_TEMP_GRACE_PERIOD_MS = 5 * 60 * 1_000;

interface EditLockMetadata {
  version: 1;
  port: number;
  token: string;
}

export interface EditTempSession {
  directory: string;
  file: string;
  close(): Promise<void>;
}

export interface EditTempOptions {
  tempRoot?: string;
}

export interface EditTempCleanupOptions extends EditTempOptions {
  gracePeriodMs?: number;
}

export interface EditTempCleanupResult {
  removed: string[];
}

function isExpectedOwner(stats: Stats): boolean {
  return typeof process.getuid !== "function" || stats.uid === process.getuid();
}

function hasMode(stats: Stats, expected: number): boolean {
  return process.platform === "win32" || (stats.mode & 0o777) === expected;
}

function parseLock(contents: Buffer): EditLockMetadata | undefined {
  if (contents.length === 0 || contents.length > MAX_LOCK_BYTES) return undefined;
  try {
    const value = JSON.parse(contents.toString("utf8")) as Record<string, unknown>;
    if (
      value.version !== LOCK_VERSION
      || !Number.isInteger(value.port)
      || (value.port as number) < 1
      || (value.port as number) > 65_535
      || typeof value.token !== "string"
      || !/^[a-f0-9]{64}$/.test(value.token)
    ) return undefined;
    return { version: LOCK_VERSION, port: value.port as number, token: value.token };
  } catch {
    return undefined;
  }
}

async function readSafeLock(directory: string): Promise<EditLockMetadata | undefined> {
  const lockPath = path.join(directory, LOCK_FILENAME);
  try {
    const stats = await lstat(lockPath);
    if (
      !stats.isFile()
      || stats.isSymbolicLink()
      || !isExpectedOwner(stats)
      || !hasMode(stats, 0o600)
      || (process.platform !== "win32" && stats.nlink !== 1)
      || stats.size > MAX_LOCK_BYTES
    ) return undefined;
    return parseLock(await readFile(lockPath));
  } catch {
    return undefined;
  }
}

async function probeLock(lock: EditLockMetadata): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const probe = createServer();
    let settled = false;
    const finish = (active: boolean): void => {
      if (settled) return;
      settled = true;
      resolve(active);
    };
    probe.once("error", () => { finish(true); });
    probe.listen({ host: "127.0.0.1", port: lock.port, exclusive: true }, () => {
      probe.close((error) => { finish(Boolean(error)); });
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (!error || (error as NodeJS.ErrnoException).code === "ERR_SERVER_NOT_RUNNING") resolve();
      else reject(error);
    });
  });
}

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not create the edit-session lock.");
  return address.port;
}

export async function createEditTempSession(
  filename: string,
  options: EditTempOptions = {},
): Promise<EditTempSession> {
  if (!filename || filename === "." || filename === ".." || path.basename(filename) !== filename) {
    throw new Error(`Invalid temporary edit filename: ${filename}`);
  }

  const directory = await mkdtemp(path.join(options.tempRoot ?? os.tmpdir(), EDIT_DIRECTORY_PREFIX));
  await chmod(directory, 0o700);
  const token = randomBytes(32).toString("hex");
  const server = createServer((socket) => {
    socket.setEncoding("utf8");
    socket.setTimeout(1_000, () => { socket.destroy(); });
    let request = "";
    socket.on("data", (chunk: string) => {
      request += chunk;
      if (request === `${token}\n`) socket.end(token);
      else if (request.length > token.length) socket.destroy();
    });
  });

  try {
    const port = await listen(server);
    await writeFile(
      path.join(directory, LOCK_FILENAME),
      JSON.stringify({ version: LOCK_VERSION, port, token } satisfies EditLockMetadata),
      { mode: 0o600, flag: "wx" },
    );
    await chmod(path.join(directory, LOCK_FILENAME), 0o600);
  } catch (error) {
    await closeServer(server).catch(() => undefined);
    await rm(directory, { recursive: true, force: true });
    throw error;
  }

  let closed = false;
  return {
    directory,
    file: path.join(directory, filename),
    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      await closeServer(server).finally(async () => {
        await rm(directory, { recursive: true, force: true });
      });
    },
  };
}

export async function isEditTempSessionActive(directory: string): Promise<boolean> {
  const lock = await readSafeLock(directory);
  return lock ? probeLock(lock) : false;
}

export async function cleanupAbandonedEditDirectories(
  options: EditTempCleanupOptions = {},
): Promise<EditTempCleanupResult> {
  const tempRoot = options.tempRoot ?? os.tmpdir();
  const gracePeriodMs = options.gracePeriodMs ?? DEFAULT_EDIT_TEMP_GRACE_PERIOD_MS;
  if (!Number.isFinite(gracePeriodMs) || gracePeriodMs < 0) throw new Error("The edit cleanup grace period must be a non-negative number.");

  const removed: string[] = [];
  const entries = await readdir(tempRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!EDIT_DIRECTORY_PATTERN.test(entry.name) || !entry.isDirectory() || entry.isSymbolicLink()) continue;
    const directory = path.join(tempRoot, entry.name);
    try {
      const stats = await lstat(directory);
      if (
        !stats.isDirectory()
        || stats.isSymbolicLink()
        || !isExpectedOwner(stats)
        || !hasMode(stats, 0o700)
        || Date.now() - stats.mtimeMs < gracePeriodMs
      ) continue;

      const lock = await readSafeLock(directory);
      if (!lock || await probeLock(lock)) continue;

      await rm(directory, { recursive: true, force: true });
      removed.push(directory);
    } catch {
      // Startup cleanup is deliberately conservative and best-effort per candidate.
    }
  }
  return { removed };
}
