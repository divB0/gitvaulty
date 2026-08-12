import { createServer } from "node:net";
import {
  chmod,
  lstat,
  mkdtemp,
  readFile,
  stat,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  cleanupAbandonedEditDirectories,
  createEditTempSession,
  isEditTempSessionActive,
} from "../src/edit-temp.js";

const roots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-edit-test-"));
  roots.push(root);
  return root;
}

async function closedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected a TCP address.");
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function deadEditDirectory(root: string): Promise<string> {
  const directory = await mkdtemp(path.join(root, "gitvaulty-edit-"));
  await chmod(directory, 0o700);
  await writeFile(path.join(directory, ".lock"), JSON.stringify({
    version: 1,
    port: await closedPort(),
    token: "a".repeat(64),
  }), { mode: 0o600 });
  const old = new Date(Date.now() - 60_000);
  await utimes(directory, old, old);
  return directory;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (root) => {
    const { rm } = await import("node:fs/promises");
    await rm(root, { recursive: true, force: true });
  }));
});

describe("edit temporary directories", () => {
  it("holds a private process lock for the session and removes everything on close", async () => {
    const root = await temporaryRoot();
    const session = await createEditTempSession(".env.production", { tempRoot: root });

    expect((await stat(session.directory)).mode & 0o777).toBe(0o700);
    const lock = await lstat(path.join(session.directory, ".lock"));
    expect(lock.isFile()).toBe(true);
    expect(lock.isSymbolicLink()).toBe(false);
    expect(lock.mode & 0o777).toBe(0o600);
    expect(path.basename(session.file)).toBe(".env.production");
    expect(await isEditTempSessionActive(session.directory)).toBe(true);

    await session.close();
    await expect(lstat(session.directory)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("removes an old directory only after its process lock is gone", async () => {
    const root = await temporaryRoot();
    const directory = await deadEditDirectory(root);

    const result = await cleanupAbandonedEditDirectories({ tempRoot: root, gracePeriodMs: 1_000 });

    expect(result.removed).toEqual([directory]);
    await expect(lstat(directory)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("never lets age override a responding process lock", async () => {
    const root = await temporaryRoot();
    const session = await createEditTempSession("secret.yaml", { tempRoot: root });
    const old = new Date(Date.now() - 60_000);
    await utimes(session.directory, old, old);

    const result = await cleanupAbandonedEditDirectories({ tempRoot: root, gracePeriodMs: 1_000 });

    expect(result.removed).toEqual([]);
    expect(await readFile(path.join(session.directory, ".lock"), "utf8")).toContain('"version":1');
    await session.close();
  });

  it("treats an occupied lock port as active even when its process does not answer", async () => {
    const root = await temporaryRoot();
    const server = createServer();
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected a TCP address.");
    const directory = await mkdtemp(path.join(root, "gitvaulty-edit-"));
    await chmod(directory, 0o700);
    await writeFile(path.join(directory, ".lock"), JSON.stringify({
      version: 1,
      port: address.port,
      token: "c".repeat(64),
    }), { mode: 0o600 });
    const old = new Date(Date.now() - 60_000);
    await utimes(directory, old, old);

    try {
      const result = await cleanupAbandonedEditDirectories({ tempRoot: root, gracePeriodMs: 1_000 });
      expect(result.removed).toEqual([]);
      expect((await lstat(directory)).isDirectory()).toBe(true);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("keeps recent unlocked directories until the grace period expires", async () => {
    const root = await temporaryRoot();
    const directory = await deadEditDirectory(root);
    const recent = new Date();
    await utimes(directory, recent, recent);

    const result = await cleanupAbandonedEditDirectories({ tempRoot: root, gracePeriodMs: 60_000 });

    expect(result.removed).toEqual([]);
    expect((await lstat(directory)).isDirectory()).toBe(true);
  });

  it("leaves malformed, missing, symlinked, and overly permissive candidates untouched", async () => {
    const root = await temporaryRoot();
    const outside = await temporaryRoot();
    const old = new Date(Date.now() - 60_000);

    const missing = await mkdtemp(path.join(root, "gitvaulty-edit-"));
    await chmod(missing, 0o700);
    await utimes(missing, old, old);

    const malformed = await mkdtemp(path.join(root, "gitvaulty-edit-"));
    await chmod(malformed, 0o700);
    await writeFile(path.join(malformed, ".lock"), "not json", { mode: 0o600 });
    await utimes(malformed, old, old);

    const permissive = await deadEditDirectory(root);
    await chmod(permissive, 0o755);

    const permissiveLock = await deadEditDirectory(root);
    await chmod(path.join(permissiveLock, ".lock"), 0o644);

    const linkedLock = await mkdtemp(path.join(root, "gitvaulty-edit-"));
    await chmod(linkedLock, 0o700);
    await writeFile(path.join(outside, "lock"), JSON.stringify({ version: 1, port: await closedPort(), token: "b".repeat(64) }), { mode: 0o600 });
    await symlink(path.join(outside, "lock"), path.join(linkedLock, ".lock"));
    await utimes(linkedLock, old, old);

    const linkedDirectory = path.join(root, "gitvaulty-edit-ABC123");
    await symlink(outside, linkedDirectory);

    const unrelated = path.join(root, "something-else");
    await writeFile(unrelated, "keep me");

    const result = await cleanupAbandonedEditDirectories({ tempRoot: root, gracePeriodMs: 1_000 });

    expect(result.removed).toEqual([]);
    for (const candidate of [missing, malformed, permissive, permissiveLock, linkedLock, linkedDirectory, unrelated]) {
      await expect(lstat(candidate)).resolves.toBeDefined();
    }
  });

  it("is safe when two startup cleanups inspect the same abandoned directory", async () => {
    const root = await temporaryRoot();
    const directory = await deadEditDirectory(root);

    const results = await Promise.all([
      cleanupAbandonedEditDirectories({ tempRoot: root, gracePeriodMs: 1_000 }),
      cleanupAbandonedEditDirectories({ tempRoot: root, gracePeriodMs: 1_000 }),
    ]);

    expect(results.flatMap((result) => result.removed)).toContain(directory);
    await expect(lstat(directory)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
