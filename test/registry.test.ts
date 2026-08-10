import { Buffer } from "node:buffer";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import { currentRecipients, generateKey } from "../src/key.js";
import { executeChecked } from "../src/process.js";
import { readRegistry, writeRegistry } from "../src/registry.js";
import { findRepository, type Repository } from "../src/repository.js";

const ageRecipient = "age1nx73yf2gmghjapkvxzkx26z72uakmnppchya8d4xfjd67hhglqdq7swsm0";

function sshEd25519(): string {
  const field = (value: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(value.length);
    return Buffer.concat([length, value]);
  };
  return `ssh-ed25519 ${Buffer.concat([field(Buffer.from("ssh-ed25519")), field(Buffer.alloc(32, 9))]).toString("base64")}`;
}

describe("recipient registry", () => {
  let root: string;
  let repo: Repository;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-registry-"));
    await executeChecked("git", ["init", "-q"], { cwd: root });
    repo = await findRepository(root);
  });

  it("normalizes and sorts usernames and recipients", async () => {
    const ssh = sshEd25519();
    await writeRegistry(repo, {
      version: 1,
      users: [
        { username: " Zoe ", recipient: `${ssh} zoe@laptop`, vaults: ["prod", "prod"] },
        { username: "alice", recipient: ageRecipient, vaults: ["dev"] },
      ],
    });

    expect(await readRegistry(repo)).toEqual({
      version: 1,
      users: [
        { username: "alice", recipient: ageRecipient, vaults: ["dev"] },
        { username: "zoe", recipient: ssh, vaults: ["prod"] },
      ],
    });
    expect(await readFile(repo.sopsConfigFile, "utf8")).toContain(ssh);
  });

  it("rejects duplicate normalized usernames and recipients", async () => {
    const ssh = sshEd25519();
    await expect(writeRegistry(repo, {
      version: 1,
      users: [
        { username: "Alice", recipient: ssh, vaults: [] },
        { username: "alice", recipient: `${ssh} second-comment`, vaults: [] },
      ],
    })).rejects.toThrow("Duplicate username or recipient");
  });

  it("rejects the retired id schema when reading", async () => {
    await mkdir(path.dirname(repo.registryFile), { recursive: true });
    await writeFile(repo.registryFile, JSON.stringify({ version: 1, users: [{ id: "alice", recipient: ageRecipient, vaults: [] }] }));
    await expect(readRegistry(repo)).rejects.toThrow("Unsupported recipient registry format");
  });

  it("discovers repository age and conventional SSH recipients", async () => {
    const age = await generateKey(repo);
    const home = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-home-"));
    await mkdir(path.join(home, ".ssh"), { recursive: true });
    await writeFile(path.join(home, ".ssh", "id_ed25519.pub"), `${sshEd25519()} alice@laptop\n`);
    await expect(currentRecipients(repo, home)).resolves.toEqual([age.recipient, sshEd25519()]);
  });
});
