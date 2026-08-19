import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import { createGroupPolicy, currentGroupPolicy } from "../src/group-policy.js";
import { createIdentity, type StoredIdentity } from "../src/key.js";
import { executeChecked } from "../src/process.js";
import {
  filesForUser,
  normalizeGroupName,
  normalizeSecretFile,
  readRegistry,
  recipientsFor,
  usernamesFor,
  writeRegistry,
  type GitVaultyUser,
  type Registry,
} from "../src/registry.js";
import { findRepository, type Repository } from "../src/repository.js";

describe("recipient registry", () => {
  let root: string;
  let repo: Repository;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-registry-"));
    await executeChecked("git", ["init", "-q"], { cwd: root });
    repo = await findRepository(root);
  });

  async function user(username: string): Promise<{ master: StoredIdentity; record: GitVaultyUser }> {
    const master = await createIdentity(path.join(root, `${username}.identity.txt`));
    return {
      master,
      record: { username, recipient: master.recipient, signingKey: master.signingKey },
    };
  }

  async function baseRegistry(): Promise<{ registry: Registry; alice: Awaited<ReturnType<typeof user>> }> {
    const alice = await user("alice");
    const team = await createGroupPolicy("team", [alice.record], ["alice"], "alice", alice.master.identity);
    return {
      alice,
      registry: { version: 4, defaultGroup: "team", users: [alice.record], groups: [team], files: [] },
    };
  }

  it("stores signed policies and deterministic effective access", async () => {
    const alice = await user("alice");
    const zoe = await user("zoe");
    const production = await createGroupPolicy("production", [zoe.record, alice.record], ["alice"], "alice", alice.master.identity);
    const team = await createGroupPolicy("team", [alice.record], ["alice"], "alice", alice.master.identity);
    await writeRegistry(repo, {
      version: 4,
      defaultGroup: " Team ",
      users: [zoe.record, alice.record],
      groups: [production, team],
      files: [
        { path: "terraform\\prod.auto.tfvars.json.gitvaulty", groups: ["production", "production"], users: [] },
        { path: ".env.production.gitvaulty", groups: ["team"], users: ["zoe", "zoe"] },
      ],
    });

    const registry = await readRegistry(repo);
    expect(registry.version).toBe(4);
    expect(registry.defaultGroup).toBe("team");
    expect(registry.users).toEqual([alice.record, zoe.record]);
    expect(registry.groups.map((group) => group.name)).toEqual(["production", "team"]);
    expect(currentGroupPolicy(registry.groups[0]!)).toMatchObject({
      revision: 1,
      managers: ["alice"],
      members: [alice.record, zoe.record],
    });
    expect(registry.files).toEqual([
      { path: ".env.production.gitvaulty", groups: ["team"], users: ["zoe"] },
      { path: "terraform/prod.auto.tfvars.json.gitvaulty", groups: ["production"], users: [] },
    ]);
    expect(usernamesFor(registry, ".env.production.gitvaulty")).toEqual(["alice", "zoe"]);
    expect(recipientsFor(registry, ".env.production.gitvaulty")).toEqual([alice.master.recipient, zoe.master.recipient].sort());
    expect(filesForUser(registry, "Zoe")).toEqual([".env.production.gitvaulty", "terraform/prod.auto.tfvars.json.gitvaulty"]);
    expect(JSON.parse(await readFile(repo.sopsConfigFile, "utf8"))).toEqual({
      creation_rules: [
        { path_regex: "^\\.env\\.production\\.gitvaulty$", age: [alice.master.recipient, zoe.master.recipient].sort().join(",") },
        { path_regex: "^terraform/prod\\.auto\\.tfvars\\.json\\.gitvaulty$", age: [alice.master.recipient, zoe.master.recipient].sort().join(",") },
      ],
    });
  });

  it("normalizes portable encrypted file paths and group names", () => {
    expect(normalizeSecretFile("terraform\\prod.auto.tfvars.json.gitvaulty")).toBe("terraform/prod.auto.tfvars.json.gitvaulty");
    expect(normalizeSecretFile(".env.gitvaulty")).toBe(".env.gitvaulty");
    expect(normalizeGroupName(" Production-Team ")).toBe("production-team");
    for (const value of ["/tmp/.env.gitvaulty", "C:\\tmp\\.env.gitvaulty", "../.env.gitvaulty", "plain.json"]) {
      expect(() => normalizeSecretFile(value)).toThrow("encrypted file path");
    }
    expect(() => normalizeGroupName("finance team")).toThrow("group name");
  });

  it("rejects duplicate identities, names, and file paths", async () => {
    const { registry, alice } = await baseRegistry();
    await expect(writeRegistry(repo, {
      ...registry,
      users: [...registry.users, { ...alice.record, username: "Alice" }],
    })).rejects.toThrow("Duplicate username, recipient, or signing key");
    await expect(writeRegistry(repo, { ...registry, groups: [...registry.groups, registry.groups[0]!] })).rejects.toThrow("Duplicate group name");
    await expect(writeRegistry(repo, { ...registry, files: [
      { path: ".env.gitvaulty", groups: ["team"], users: [] },
      { path: ".env.gitvaulty", groups: ["team"], users: [] },
    ] })).rejects.toThrow("Duplicate encrypted file path");
  });

  it("rejects dangling grants, unsigned identities, and empty effective access", async () => {
    const { registry, alice } = await baseRegistry();
    const bob = await user("bob");
    const teamWithBob = await createGroupPolicy("team", [alice.record, bob.record], ["alice"], "alice", alice.master.identity);
    await expect(writeRegistry(repo, { ...registry, defaultGroup: "missing" })).rejects.toThrow("Unknown default group");
    await expect(writeRegistry(repo, { ...registry, groups: [teamWithBob] })).rejects.toThrow("Unknown or changed user in group team: bob");
    await expect(writeRegistry(repo, { ...registry, files: [{ path: ".env.gitvaulty", groups: ["missing"], users: [] }] })).rejects.toThrow("Unknown group");
    await expect(writeRegistry(repo, { ...registry, files: [{ path: ".env.gitvaulty", groups: [], users: ["missing"] }] })).rejects.toThrow("Unknown user");
    await expect(writeRegistry(repo, { ...registry, files: [{ path: ".env.gitvaulty", groups: [], users: [] }] })).rejects.toThrow("at least one recipient");
  });

  it("rejects unsupported keys and retired registry schemas", async () => {
    const { registry } = await baseRegistry();
    await expect(writeRegistry(repo, {
      ...registry,
      users: [{ ...registry.users[0]!, recipient: "ssh-ed25519 invalid" }],
    })).rejects.toThrow("valid public age recipient");
    await expect(writeRegistry(repo, {
      ...registry,
      users: [{ ...registry.users[0]!, signingKey: "ed25519:invalid" }],
    })).rejects.toThrow("Invalid Ed25519 public key");

    await mkdir(path.dirname(repo.registryFile), { recursive: true });
    await writeFile(repo.registryFile, JSON.stringify({ version: 3, users: registry.users, groups: [], files: [] }));
    await expect(readRegistry(repo)).rejects.toThrow("Unsupported recipient registry format");
  });
});
