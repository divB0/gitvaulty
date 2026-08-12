import { access, mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { generateIdentity, identityToRecipient } from "age-encryption";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createIdentity } from "../src/key.js";
import {
  addUser,
  cleanSecretFiles,
  importSecretFile,
  initialize,
  materializeSecretFiles,
  removeUser,
  runWithFiles,
  statusSecretFiles,
} from "../src/operations.js";
import { executeChecked } from "../src/process.js";
import { readRegistry, recipientsFor } from "../src/registry.js";
import { findRepository, type Repository } from "../src/repository.js";

describe("GitVaulty hybrid native-file workflow", () => {
  let root: string;
  let repo: Repository;
  let ownerIdentity: string;
  let previousKeyFile: string | undefined;
  let previousGitVaultyKey: string | undefined;
  let previousSopsAgeKey: string | undefined;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-integration-"));
    previousKeyFile = process.env.GITVAULTY_AGE_KEY_FILE;
    previousGitVaultyKey = process.env.GITVAULTY_KEY;
    previousSopsAgeKey = process.env.SOPS_AGE_KEY;
    process.env.GITVAULTY_AGE_KEY_FILE = path.join(root, "identity.txt");
    delete process.env.GITVAULTY_KEY;
    delete process.env.SOPS_AGE_KEY;
    await executeChecked("git", ["init", "-q"], { cwd: root });
    repo = await findRepository(root);
    const owner = await createIdentity();
    ownerIdentity = owner.identity;
    await initialize(repo, { username: "owner", recipient: owner.recipient });
  });

  afterEach(() => {
    if (previousKeyFile === undefined) delete process.env.GITVAULTY_AGE_KEY_FILE;
    else process.env.GITVAULTY_AGE_KEY_FILE = previousKeyFile;
    if (previousGitVaultyKey === undefined) delete process.env.GITVAULTY_KEY;
    else process.env.GITVAULTY_KEY = previousGitVaultyKey;
    if (previousSopsAgeKey === undefined) delete process.env.SOPS_AGE_KEY;
    else process.env.SOPS_AGE_KEY = previousSopsAgeKey;
  });

  async function importFixtures(): Promise<void> {
    await writeFile(path.join(root, ".env.production"), "TOKEN=very-secret\nPORT=4321\n");
    await mkdir(path.join(root, "terraform"));
    await writeFile(path.join(root, "terraform", "secrets.auto.tfvars.json"), `${JSON.stringify({ api_token: "terraform-secret" })}\n`);
    await importSecretFile(repo, ".env.production");
    await importSecretFile(repo, "terraform/secrets.auto.tfvars.json");
  }

  it("reports, materializes, and safely cleans persistent plaintext files", async () => {
    await importFixtures();
    expect((await statusSecretFiles(repo)).map((item) => item.state)).toEqual(["current", "current"]);
    expect(await cleanSecretFiles(repo)).toEqual({
      removed: [".env.production", "terraform/secrets.auto.tfvars.json"],
      retained: [],
    });
    expect((await statusSecretFiles(repo)).map((item) => item.state)).toEqual(["missing", "missing"]);
    expect(await materializeSecretFiles(repo)).toEqual([".env.production", "terraform/secrets.auto.tfvars.json"]);
    expect((await stat(path.join(root, ".env.production"))).mode & 0o777).toBe(0o600);

    await writeFile(path.join(root, ".env.production"), "TOKEN=local-change\n");
    expect((await statusSecretFiles(repo, [".env.production"]))[0]!.state).toBe("modified");
    expect(await cleanSecretFiles(repo, [".env.production"])).toEqual({
      removed: [],
      retained: [{ file: ".env.production", encryptedFile: ".env.production.gitvaulty", state: "modified" }],
    });
    await expect(materializeSecretFiles(repo, [".env.production"])).rejects.toThrow("modified");
  }, 30_000);

  it("defaults run to all accessible files and removes only outputs it created", async () => {
    await importFixtures();
    await cleanSecretFiles(repo);
    process.env.GITVAULTY_KEY = ownerIdentity;
    process.env.SOPS_AGE_KEY = await generateIdentity();
    const captured = path.join(root, "captured.json");
    const script = [
      "const fs=require('node:fs');",
      "const env=fs.readFileSync('.env.production','utf8');",
      "const terraform=JSON.parse(fs.readFileSync('terraform/secrets.auto.tfvars.json','utf8'));",
      `fs.writeFileSync(${JSON.stringify(captured)},JSON.stringify({env,terraform,mode:fs.statSync('.env.production').mode&0o777,key:process.env.GITVAULTY_KEY??null,sops:process.env.SOPS_AGE_KEY??null}));`,
      "process.exit(7);",
    ].join("");
    expect(await runWithFiles(repo, [], [process.execPath, "-e", script])).toEqual({ code: 7, retained: [] });
    expect(JSON.parse(await readFile(captured, "utf8"))).toEqual({
      env: "TOKEN=very-secret\nPORT=4321\n",
      terraform: { api_token: "terraform-secret" },
      mode: 0o600,
      key: null,
      sops: null,
    });
    await expect(access(path.join(root, ".env.production"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(path.join(root, "terraform", "secrets.auto.tfvars.json"))).rejects.toMatchObject({ code: "ENOENT" });
  }, 30_000);

  it("preserves current pre-existing files and child-modified owned files", async () => {
    await writeFile(path.join(root, ".env"), "TOKEN=secret\n");
    await importSecretFile(repo, ".env");
    expect(await runWithFiles(repo, [".env"], [process.execPath, "-e", "process.exit(0)"])).toEqual({ code: 0, retained: [] });
    expect(await readFile(path.join(root, ".env"), "utf8")).toBe("TOKEN=secret\n");

    await cleanSecretFiles(repo);
    const script = "require('node:fs').writeFileSync('.env','TOKEN=changed-by-child\\n')";
    expect(await runWithFiles(repo, [".env"], [process.execPath, "-e", script])).toEqual({ code: 0, retained: [".env"] });
    expect(await readFile(path.join(root, ".env"), "utf8")).toBe("TOKEN=changed-by-child\n");
  }, 30_000);

  it("refuses tracked destinations before materializing anything", async () => {
    await importFixtures();
    await cleanSecretFiles(repo);
    await writeFile(path.join(root, ".env.production"), "tracked\n");
    await executeChecked("git", ["add", "-f", ".env.production"], { cwd: root });
    await expect(materializeSecretFiles(repo)).rejects.toThrow("tracked");
    await expect(access(path.join(root, "terraform", "secrets.auto.tfvars.json"))).rejects.toMatchObject({ code: "ENOENT" });
  }, 30_000);

  it("updates and rotates recipients while preserving opaque content", async () => {
    await writeFile(path.join(root, "secrets.txt"), "username=admin\npassword=secret\n");
    await importSecretFile(repo, "secrets.txt");
    const teammateRecipient = await identityToRecipient(await generateIdentity());
    await addUser(repo, { username: "teammate", recipient: teammateRecipient, files: ["secrets.txt.gitvaulty"] });
    expect(recipientsFor(await readRegistry(repo), "secrets.txt.gitvaulty")).toHaveLength(2);
    await removeUser(repo, "teammate");
    expect(recipientsFor(await readRegistry(repo), "secrets.txt.gitvaulty")).toHaveLength(1);
    await cleanSecretFiles(repo);
    await materializeSecretFiles(repo);
    expect(await readFile(path.join(root, "secrets.txt"), "utf8")).toBe("username=admin\npassword=secret\n");
  }, 30_000);
});
