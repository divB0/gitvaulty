import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { generateIdentity, identityToRecipient } from "age-encryption";
import { beforeEach, describe, expect, it } from "vitest";

import { executeChecked } from "../src/process.js";
import { normalizeSecretFile, readRegistry, recipientsFor, writeRegistry } from "../src/registry.js";
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

  it("normalizes users and stores deterministic per-file access", async () => {
    const secondRecipient = await identityToRecipient(await generateIdentity());
    await writeRegistry(repo, {
      version: 2,
      users: [
        { username: " Zoe ", recipient: secondRecipient, files: ["terraform/prod.auto.tfvars.json.gitvaulty", "terraform/prod.auto.tfvars.json.gitvaulty"] },
        { username: "alice", recipient: ageRecipient, files: [".env.production.gitvaulty"] },
      ],
    });

    expect(await readRegistry(repo)).toEqual({
      version: 2,
      users: [
        { username: "alice", recipient: ageRecipient, files: [".env.production.gitvaulty"] },
        { username: "zoe", recipient: secondRecipient, files: ["terraform/prod.auto.tfvars.json.gitvaulty"] },
      ],
    });
    expect(recipientsFor(await readRegistry(repo), ".env.production.gitvaulty")).toEqual([ageRecipient]);
    expect(JSON.parse(await readFile(repo.sopsConfigFile, "utf8"))).toEqual({
      creation_rules: [
        { path_regex: "^\\.env\\.production\\.gitvaulty$", age: ageRecipient },
        { path_regex: "^terraform/prod\\.auto\\.tfvars\\.json\\.gitvaulty$", age: secondRecipient },
      ],
    });
  });

  it("normalizes portable encrypted file paths", () => {
    expect(normalizeSecretFile("terraform\\prod.auto.tfvars.json.gitvaulty")).toBe("terraform/prod.auto.tfvars.json.gitvaulty");
    expect(normalizeSecretFile(".env.gitvaulty")).toBe(".env.gitvaulty");
    for (const value of [
      "/tmp/.env.gitvaulty",
      "C:\\tmp\\.env.gitvaulty",
      "../.env.gitvaulty",
      "secrets/../.env.gitvaulty",
      ".git/config.gitvaulty",
      ".gitvaulty/recipients.json.gitvaulty",
      "plain.json",
      ".gitvaulty",
    ]) expect(() => normalizeSecretFile(value)).toThrow("encrypted file path");
  });

  it("rejects duplicate normalized usernames or recipients", async () => {
    await expect(writeRegistry(repo, {
      version: 2,
      users: [
        { username: "Alice", recipient: ageRecipient, files: [] },
        { username: "alice", recipient: ageRecipient, files: [] },
      ],
    })).rejects.toThrow("Duplicate username or recipient");
  });

  it("rejects unsupported recipients and retired registry schemas", async () => {
    await expect(writeRegistry(repo, {
      version: 2,
      users: [{ username: "alice", recipient: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", files: [] }],
    })).rejects.toThrow("Unsupported recipient registry format");

    await mkdir(path.dirname(repo.registryFile), { recursive: true });
    await writeFile(repo.registryFile, JSON.stringify({ version: 1, users: [{ username: "alice", recipient: ageRecipient, vaults: [] }] }));
    await expect(readRegistry(repo)).rejects.toThrow("Unsupported recipient registry format");
  });
});
