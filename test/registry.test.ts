import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { generateIdentity, identityToRecipient } from "age-encryption";
import { beforeEach, describe, expect, it } from "vitest";

import { executeChecked } from "../src/process.js";
import { readRegistry, writeRegistry } from "../src/registry.js";
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

  it("normalizes and sorts usernames and native age recipients", async () => {
    const secondRecipient = await identityToRecipient(await generateIdentity());
    await writeRegistry(repo, {
      version: 1,
      users: [
        { username: " Zoe ", recipient: secondRecipient, vaults: ["prod", "prod"] },
        { username: "alice", recipient: ageRecipient, vaults: ["dev"] },
      ],
    });

    expect(await readRegistry(repo)).toEqual({
      version: 1,
      users: [
        { username: "alice", recipient: ageRecipient, vaults: ["dev"] },
        { username: "zoe", recipient: secondRecipient, vaults: ["prod"] },
      ],
    });
    expect(await readFile(repo.sopsConfigFile, "utf8")).toContain(secondRecipient);
  });

  it("rejects duplicate normalized usernames or recipients", async () => {
    await expect(writeRegistry(repo, {
      version: 1,
      users: [
        { username: "Alice", recipient: ageRecipient, vaults: [] },
        { username: "alice", recipient: ageRecipient, vaults: [] },
      ],
    })).rejects.toThrow("Duplicate username or recipient");
  });

  it("rejects SSH recipients", async () => {
    await expect(writeRegistry(repo, {
      version: 1,
      users: [{ username: "alice", recipient: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", vaults: [] }],
    })).rejects.toThrow("Unsupported recipient registry format");
  });

  it("rejects the retired id schema when reading", async () => {
    await mkdir(path.dirname(repo.registryFile), { recursive: true });
    await writeFile(repo.registryFile, JSON.stringify({ version: 1, users: [{ id: "alice", recipient: ageRecipient, vaults: [] }] }));
    await expect(readRegistry(repo)).rejects.toThrow("Unsupported recipient registry format");
  });
});
