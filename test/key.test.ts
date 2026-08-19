import { mkdtemp, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  createIdentity,
  currentIdentity,
  currentRecipient,
  deriveIdentity,
  identityFile,
  readIdentity,
  readStoredIdentity,
  restoreIdentity,
  signMessage,
  verifyMessage,
} from "../src/key.js";

describe("global GitVaulty identity", () => {
  it("resolves overrides and platform configuration directories", () => {
    expect(identityFile({ GITVAULTY_AGE_KEY_FILE: "/secure/gitvaulty.txt" }, "/home/alice", "linux")).toBe("/secure/gitvaulty.txt");
    expect(identityFile({ SOPS_AGE_KEY_FILE: "/secure/sops.txt" }, "/home/alice", "linux")).toBe("/home/alice/.config/gitvaulty/identity");
    expect(identityFile({ XDG_CONFIG_HOME: "/config" }, "/home/alice", "linux")).toBe("/config/gitvaulty/identity");
    expect(identityFile({ APPDATA: "C:\\Users\\alice\\AppData" }, "C:\\Users\\alice", "win32")).toBe(path.join("C:\\Users\\alice\\AppData", "gitvaulty", "identity"));
    expect(identityFile({}, "/home/alice", "linux")).toBe("/home/alice/.config/gitvaulty/identity");
  });

  it("creates one secure master identity and derives both public keys", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-key-"));
    const file = path.join(root, "config", "identity.txt");
    const created = await createIdentity(file);
    expect(created.identity).toMatch(/^GITVAULTY-IDENTITY-1/);
    expect(created.ageIdentity).toMatch(/^AGE-SECRET-KEY-1/);
    expect(created.recipient).toMatch(/^age1/);
    expect(created.signingKey).toMatch(/^ed25519:/);
    expect(await readIdentity(file)).toBe(created.identity);
    expect(await currentIdentity(file)).toEqual(created);
    expect(await currentRecipient(file)).toBe(created.recipient);
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    await expect(createIdentity(file)).rejects.toThrow("already exists");
  });

  it("derives stable purpose-separated keys and signs verifiable messages", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-sign-"));
    const created = await createIdentity(path.join(root, "identity.txt"));
    const again = await deriveIdentity(created.identity);
    expect(again).toEqual(created);
    expect(created.ageIdentity).not.toContain(created.signingKey.slice("ed25519:".length));

    const message = Buffer.from("group policy revision 2");
    const signature = await signMessage(created.identity, message);
    expect(signature).toMatch(/^ed25519:/);
    expect(verifyMessage(created.signingKey, message, signature)).toBe(true);
    expect(verifyMessage(created.signingKey, Buffer.from("tampered"), signature)).toBe(false);
  });

  it("restores a validated backup and requires replacement permission", async () => {
    const firstRoot = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-first-"));
    const secondRoot = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-second-"));
    const first = await createIdentity(path.join(firstRoot, "identity.txt"));
    const second = await createIdentity(path.join(secondRoot, "identity.txt"));
    const file = path.join(await mkdtemp(path.join(os.tmpdir(), "gitvaulty-restore-")), "identity.txt");
    await expect(restoreIdentity("not-a-key", file)).rejects.toThrow("valid GitVaulty master identity");
    await restoreIdentity(first.identity, file);
    await expect(restoreIdentity(second.identity, file)).rejects.toThrow("already exists");
    const restored = await restoreIdentity(second.identity, file, true);
    expect(restored).toEqual(second);
    expect(await readFile(file, "utf8")).toContain(second.identity);
  });

  it("loads environment identities with GitVaulty precedence", async () => {
    const firstRoot = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-env-first-"));
    const secondRoot = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-env-second-"));
    const gitvaulty = await createIdentity(path.join(firstRoot, "identity.txt"));
    const stored = await createIdentity(path.join(secondRoot, "identity.txt"));
    const storedFile = path.join(secondRoot, "identity.txt");
    expect(await readIdentity(storedFile, { GITVAULTY_KEY: gitvaulty.identity })).toBe(gitvaulty.identity);
    expect(await readIdentity(storedFile, { SOPS_AGE_KEY: stored.ageIdentity })).toBe(stored.identity);
    expect(await currentRecipient(storedFile, { GITVAULTY_KEY: gitvaulty.identity })).toBe(gitvaulty.recipient);
    await expect(readIdentity(storedFile, { GITVAULTY_KEY: "invalid" })).rejects.toThrow("valid GitVaulty master identity");
  });

  it("keeps persistent backups separate from environment identities", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-stored-"));
    const injectedRoot = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-injected-"));
    const file = path.join(root, "identity.txt");
    const stored = await createIdentity(file);
    const injected = await createIdentity(path.join(injectedRoot, "identity.txt"));
    expect(await readIdentity(file, { GITVAULTY_KEY: injected.identity })).toBe(injected.identity);
    expect(await readStoredIdentity(file)).toBe(stored.identity);
  });
});
