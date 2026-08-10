import { mkdtemp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Buffer } from "node:buffer";
import { beforeEach, describe, expect, it } from "vitest";
import { executeChecked } from "../src/process.js";
import { addUser, createVault, initialize, removeUser, runWithVault, vaultData, vaultFile } from "../src/operations.js";
import { findRepository } from "../src/repository.js";
import { generateKey } from "../src/key.js";
import { readRegistry, recipientsFor } from "../src/registry.js";
import { encryptVault } from "../src/sops.js";
import { checkVault, renderVault } from "../src/templates.js";

describe("GitVaulty workflow", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-test-"));
    await executeChecked("git", ["init", "-q"], { cwd: root });
  });

  it("creates, renders, checks, runs, and rotates a vault", async () => {
    const repo = await findRepository(root);
    const owner = await generateKey(repo);
    await initialize(repo, { username: "owner", recipient: owner.recipient });
    await createVault(repo, "dev");

    const registry = await readRegistry(repo);
    const plaintext = { env: { TOKEN: "very-secret", PORT: 4321 }, terraform: { region: "eu-west-1" } };
    const relative = path.relative(repo.root, vaultFile(repo, "dev")).split(path.sep).join("/");
    await writeFile(vaultFile(repo, "dev"), await encryptVault(repo, relative, `${JSON.stringify(plaintext)}\n`, recipientsFor(registry, "dev")));
    expect(await readFile(vaultFile(repo, "dev"), "utf8")).not.toContain("very-secret");
    expect(await vaultData(repo, "dev")).toEqual(plaintext);

    const templates = path.join(repo.vaultsDir, "dev", "templates");
    await mkdir(path.join(templates, "apps", "api"), { recursive: true });
    await writeFile(path.join(templates, "apps", "api", ".env.local.tpl"), "TOKEN={{env.TOKEN}}\nPORT={{env.PORT}}\n");
    await renderVault(repo, "dev");
    const output = path.join(repo.root, "apps", "api", ".env.local");
    expect(await readFile(output, "utf8")).toBe("TOKEN=very-secret\nPORT=4321\n");
    expect((await stat(output)).mode & 0o777).toBe(0o600);
    expect(await checkVault(repo, "dev")).toEqual([]);
    await writeFile(output, "stale\n");
    expect(await checkVault(repo, "dev")).toEqual(["apps/api/.env.local"]);

    const captured = path.join(root, "captured.txt");
    expect(await runWithVault(repo, "dev", [process.execPath, "-e", `require('node:fs').writeFileSync(${JSON.stringify(captured)}, process.env.TOKEN)`])).toBe(0);
    expect(await readFile(captured, "utf8")).toBe("very-secret");

    const field = (value: Buffer) => {
      const length = Buffer.alloc(4);
      length.writeUInt32BE(value.length);
      return Buffer.concat([length, value]);
    };
    const sshRecipient = `ssh-ed25519 ${Buffer.concat([field(Buffer.from("ssh-ed25519")), field(Buffer.alloc(32, 11))]).toString("base64")}`;
    const teammate = { username: "teammate", recipient: sshRecipient, vaults: ["dev"] };
    await addUser(repo, teammate);
    expect(recipientsFor(await readRegistry(repo), "dev")).toHaveLength(2);
    await removeUser(repo, "teammate");
    expect(recipientsFor(await readRegistry(repo), "dev")).toEqual([owner.recipient]);
    expect(await vaultData(repo, "dev")).toEqual(plaintext);
  }, 30_000);
});
