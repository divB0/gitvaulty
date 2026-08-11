import { mkdtemp, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { generateIdentity, identityToRecipient } from "age-encryption";
import { describe, expect, it } from "vitest";

import { createIdentity, currentRecipient, identityFile, readIdentity, readStoredIdentity, restoreIdentity } from "../src/key.js";

describe("global age identity", () => {
  it("resolves overrides and platform configuration directories", () => {
    expect(identityFile({ GITVAULTY_AGE_KEY_FILE: "/secure/gitvaulty.txt" }, "/home/alice", "linux")).toBe("/secure/gitvaulty.txt");
    expect(identityFile({ SOPS_AGE_KEY_FILE: "/secure/sops.txt" }, "/home/alice", "linux")).toBe("/secure/sops.txt");
    expect(identityFile({ XDG_CONFIG_HOME: "/config" }, "/home/alice", "linux")).toBe("/config/gitvaulty/identity.txt");
    expect(identityFile({ APPDATA: "C:\\Users\\alice\\AppData" }, "C:\\Users\\alice", "win32")).toBe(path.join("C:\\Users\\alice\\AppData", "gitvaulty", "identity.txt"));
    expect(identityFile({}, "/home/alice", "linux")).toBe("/home/alice/.config/gitvaulty/identity.txt");
  });

  it("creates one secure identity and derives its public recipient", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-key-"));
    const file = path.join(root, "config", "identity.txt");
    const created = await createIdentity(file);
    expect(created.identity).toMatch(/^AGE-SECRET-KEY-/);
    expect(created.recipient).toMatch(/^age1/);
    expect(await readIdentity(file)).toBe(created.identity);
    expect(await currentRecipient(file)).toBe(created.recipient);
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    await expect(createIdentity(file)).rejects.toThrow("already exists");
  });

  it("restores a validated backup and requires replacement permission", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-restore-"));
    const file = path.join(root, "identity.txt");
    const first = await generateIdentity();
    const second = await generateIdentity();
    await expect(restoreIdentity("not-a-key", file)).rejects.toThrow("valid native age private key");
    await restoreIdentity(first, file);
    await expect(restoreIdentity(second, file)).rejects.toThrow("already exists");
    const restored = await restoreIdentity(second, file, true);
    expect(restored).toEqual({ identity: second, recipient: await identityToRecipient(second) });
    expect(await readFile(file, "utf8")).toContain(second);
  });

  it("loads environment identities with GitVaulty precedence", async () => {
    const gitvaulty = await generateIdentity();
    const sops = await generateIdentity();
    const missing = path.join(await mkdtemp(path.join(os.tmpdir(), "gitvaulty-env-")), "missing.txt");
    expect(await readIdentity(missing, { GITVAULTY_KEY: gitvaulty, SOPS_AGE_KEY: sops })).toBe(gitvaulty);
    expect(await readIdentity(missing, { SOPS_AGE_KEY: sops })).toBe(sops);
    expect(await currentRecipient(missing, { GITVAULTY_KEY: gitvaulty })).toBe(await identityToRecipient(gitvaulty));
    await expect(readIdentity(missing, { GITVAULTY_KEY: "invalid", SOPS_AGE_KEY: sops })).rejects.toThrow("valid native age private key");
  });

  it("keeps persistent backups separate from environment identities", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-stored-"));
    const file = path.join(root, "identity.txt");
    const stored = await createIdentity(file);
    const injected = await generateIdentity();
    expect(await readIdentity(file, { GITVAULTY_KEY: injected })).toBe(injected);
    expect(await readStoredIdentity(file)).toBe(stored.identity);
  });
});
