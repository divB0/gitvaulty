import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { generateIdentity, identityToRecipient } from "age-encryption";
import { beforeEach, describe, expect, it } from "vitest";

import { executeChecked } from "../src/process.js";
import {
  filesForUser,
  normalizeGroupName,
  normalizeSecretFile,
  readRegistry,
  recipientsFor,
  usernamesFor,
  writeRegistry,
} from "../src/registry.js";
import { findRepository, type Repository } from "../src/repository.js";

const ageRecipient = "age1nx73yf2gmghjapkvxzkx26z72uakmnppchya8d4xfjd67hhglqdq7swsm0";

describe("recipient registry", () => {
  let root: string;
  let repo: Repository;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-registry-"));
    await executeChecked("git", ["init", "-q"], { cwd: root });
    repo = await findRepository(root);
  });

  it("normalizes group policies and stores deterministic effective access", async () => {
    const secondRecipient = await identityToRecipient(await generateIdentity());
    await writeRegistry(repo, {
      version: 3,
      defaultGroup: " Team ",
      users: [
        { username: " Zoe ", recipient: secondRecipient },
        { username: "alice", recipient: ageRecipient },
      ],
      groups: [
        { name: "Production", members: ["Zoe", "alice", "alice"] },
        { name: "team", members: ["alice"] },
      ],
      files: [
        { path: "terraform\\prod.auto.tfvars.json.gitvaulty", groups: ["production", "production"], users: [] },
        { path: ".env.production.gitvaulty", groups: ["team"], users: ["zoe", "zoe"] },
      ],
    });

    const registry = await readRegistry(repo);
    expect(registry).toEqual({
      version: 3,
      defaultGroup: "team",
      users: [
        { username: "alice", recipient: ageRecipient },
        { username: "zoe", recipient: secondRecipient },
      ],
      groups: [
        { name: "production", members: ["alice", "zoe"] },
        { name: "team", members: ["alice"] },
      ],
      files: [
        { path: ".env.production.gitvaulty", groups: ["team"], users: ["zoe"] },
        { path: "terraform/prod.auto.tfvars.json.gitvaulty", groups: ["production"], users: [] },
      ],
    });
    expect(usernamesFor(registry, ".env.production.gitvaulty")).toEqual(["alice", "zoe"]);
    expect(recipientsFor(registry, ".env.production.gitvaulty")).toEqual([ageRecipient, secondRecipient].sort());
    expect(filesForUser(registry, "Zoe")).toEqual([".env.production.gitvaulty", "terraform/prod.auto.tfvars.json.gitvaulty"]);
    expect(JSON.parse(await readFile(repo.sopsConfigFile, "utf8"))).toEqual({
      creation_rules: [
        { path_regex: "^\\.env\\.production\\.gitvaulty$", age: [ageRecipient, secondRecipient].sort().join(",") },
        { path_regex: "^terraform/prod\\.auto\\.tfvars\\.json\\.gitvaulty$", age: [ageRecipient, secondRecipient].sort().join(",") },
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
    const base = {
      version: 3 as const,
      defaultGroup: "team",
      users: [{ username: "alice", recipient: ageRecipient }],
      groups: [{ name: "team", members: ["alice"] }],
      files: [] as { path: string; groups: string[]; users: string[] }[],
    };
    await expect(writeRegistry(repo, { ...base, users: [...base.users, { username: "Alice", recipient: ageRecipient }] })).rejects.toThrow("Duplicate username or recipient");
    await expect(writeRegistry(repo, { ...base, groups: [...base.groups, { name: "Team", members: [] }] })).rejects.toThrow("Duplicate group name");
    await expect(writeRegistry(repo, { ...base, files: [
      { path: ".env.gitvaulty", groups: ["team"], users: [] },
      { path: ".env.gitvaulty", groups: ["team"], users: [] },
    ] })).rejects.toThrow("Duplicate encrypted file path");
  });

  it("rejects dangling grants and policies with no effective recipients", async () => {
    const base = {
      version: 3 as const,
      defaultGroup: "team",
      users: [{ username: "alice", recipient: ageRecipient }],
      groups: [{ name: "team", members: ["alice"] }],
      files: [] as { path: string; groups: string[]; users: string[] }[],
    };
    await expect(writeRegistry(repo, { ...base, defaultGroup: "missing" })).rejects.toThrow("Unknown default group");
    await expect(writeRegistry(repo, { ...base, groups: [{ name: "team", members: ["missing"] }] })).rejects.toThrow("Unknown user in group");
    await expect(writeRegistry(repo, { ...base, files: [{ path: ".env.gitvaulty", groups: ["missing"], users: [] }] })).rejects.toThrow("Unknown group");
    await expect(writeRegistry(repo, { ...base, files: [{ path: ".env.gitvaulty", groups: [], users: ["missing"] }] })).rejects.toThrow("Unknown user");
    await expect(writeRegistry(repo, { ...base, groups: [{ name: "team", members: [] }], files: [{ path: ".env.gitvaulty", groups: ["team"], users: [] }] })).rejects.toThrow("at least one recipient");
  });

  it("rejects unsupported recipients and retired registry schemas", async () => {
    await expect(writeRegistry(repo, {
      version: 3,
      defaultGroup: "team",
      users: [{ username: "alice", recipient: "ssh-ed25519 invalid" }],
      groups: [{ name: "team", members: ["alice"] }],
      files: [],
    })).rejects.toThrow("valid public age recipient");

    await mkdir(path.dirname(repo.registryFile), { recursive: true });
    await writeFile(repo.registryFile, JSON.stringify({ version: 2, users: [{ username: "alice", recipient: ageRecipient, files: [] }] }));
    await expect(readRegistry(repo)).rejects.toThrow("Unsupported recipient registry format");
  });
});
