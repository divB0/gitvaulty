import { access, mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createIdentity } from "../src/key.js";
import {
  addGroupMember,
  addGroupManager,
  addUser,
  cleanSecretFiles,
  createGroup,
  deleteGroup,
  diffSecretFiles,
  importSecretFile,
  initialize,
  materializeSecretFiles,
  registerUser,
  removeGroupMember,
  removeGroupManager,
  removeUser,
  runWithFiles,
  setFileAccess,
  statusSecretFiles,
} from "../src/operations.js";
import { executeChecked } from "../src/process.js";
import { readRegistry, recipientsFor } from "../src/registry.js";
import { findRepository, type Repository } from "../src/repository.js";
import { decryptSecretFile } from "../src/sops.js";

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
    await initialize(repo, { username: "owner", recipient: owner.recipient, signingKey: owner.signingKey });
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

  it("compares encrypted sources with selected local plaintext files", async () => {
    await importFixtures();
    await writeFile(path.join(root, ".env.production"), "TOKEN=local-change\n");

    expect(await diffSecretFiles(repo)).toEqual([{
      file: ".env.production",
      encryptedFile: ".env.production.gitvaulty",
      oldContent: Buffer.from("TOKEN=very-secret\nPORT=4321\n"),
      newContent: Buffer.from("TOKEN=local-change\n"),
    }]);
    expect(await diffSecretFiles(repo, ["terraform/secrets.auto.tfvars.json"])).toEqual([]);

    await writeFile(path.join(root, ".env.production"), "TOKEN=very-secret\nPORT=4321\n");
    await cleanSecretFiles(repo, [".env.production"]);
    expect(await diffSecretFiles(repo, [".env.production"])).toEqual([{
      file: ".env.production",
      encryptedFile: ".env.production.gitvaulty",
      oldContent: Buffer.from("TOKEN=very-secret\nPORT=4321\n"),
      newContent: Buffer.alloc(0),
    }]);
  }, 30_000);

  it("rejects tracked and unsafe plaintext destinations when diffing", async () => {
    await writeFile(path.join(root, ".env"), "TOKEN=secret\n");
    await importSecretFile(repo, ".env");
    await executeChecked("git", ["add", "-f", ".env"], { cwd: root });
    await expect(diffSecretFiles(repo, [".env"])).rejects.toThrow(".env is tracked");

    await executeChecked("git", ["rm", "--cached", "-q", ".env"], { cwd: root });
    await cleanSecretFiles(repo, [".env"]);
    await mkdir(path.join(root, ".env"));
    await expect(diffSecretFiles(repo, [".env"])).rejects.toThrow(".env is unsafe");
  }, 30_000);

  it("defaults run to all accessible files and removes only outputs it created", async () => {
    await importFixtures();
    await cleanSecretFiles(repo);
    process.env.GITVAULTY_KEY = ownerIdentity;
    process.env.SOPS_AGE_KEY = "AGE-SECRET-KEY-UNRELATED";
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
    const teammate = await createIdentity(path.join(root, "teammate.identity.txt"));
    await addUser(repo, { username: "teammate", recipient: teammate.recipient, signingKey: teammate.signingKey, groups: ["team"] });
    expect(recipientsFor(await readRegistry(repo), "secrets.txt.gitvaulty")).toHaveLength(2);
    await removeUser(repo, "teammate");
    expect(recipientsFor(await readRegistry(repo), "secrets.txt.gitvaulty")).toHaveLength(1);
    await cleanSecretFiles(repo);
    await materializeSecretFiles(repo);
    expect(await readFile(path.join(root, "secrets.txt"), "utf8")).toBe("username=admin\npassword=secret\n");
  }, 30_000);

  it("uses groups for onboarding and re-encrypts files when membership changes", async () => {
    await createGroup(repo, "production");
    await writeFile(path.join(root, "prod.env"), "TOKEN=production\n");
    await importSecretFile(repo, "prod.env", { groups: ["production"] });

    const teammate = await createIdentity(path.join(root, "teammate.identity.txt"));
    const teammateRecipient = teammate.recipient;
    await addUser(repo, { username: "teammate", recipient: teammateRecipient, signingKey: teammate.signingKey, groups: ["production"] });
    expect(recipientsFor(await readRegistry(repo), "prod.env.gitvaulty")).toEqual([
      teammateRecipient,
      (await readRegistry(repo)).users.find((user) => user.username === "owner")!.recipient,
    ].sort());
    process.env.GITVAULTY_KEY = teammate.identity;
    expect(await decryptSecretFile(repo, path.join(root, "prod.env.gitvaulty"))).toEqual(Buffer.from("TOKEN=production\n"));
    process.env.GITVAULTY_KEY = ownerIdentity;

    await removeGroupMember(repo, "production", "teammate");
    expect(recipientsFor(await readRegistry(repo), "prod.env.gitvaulty")).toHaveLength(1);
    process.env.GITVAULTY_KEY = teammate.identity;
    await expect(decryptSecretFile(repo, path.join(root, "prod.env.gitvaulty"))).rejects.toThrow();
    process.env.GITVAULTY_KEY = ownerIdentity;
    await expect(deleteGroup(repo, "production")).rejects.toThrow("still used by");
    await expect(deleteGroup(repo, "team")).rejects.toThrow("default group");

    await setFileAccess(repo, "prod.env", { groups: ["team"], users: [] });
    await deleteGroup(repo, "production");
    expect((await readRegistry(repo)).groups.map((group) => group.name)).toEqual(["team"]);
    expect(await readFile(path.join(root, "prod.env"), "utf8")).toBe("TOKEN=production\n");
  }, 30_000);

  it("supports direct grants and prevents policies that remove the final recipient", async () => {
    await writeFile(path.join(root, "direct.txt"), "direct secret\n");
    await importSecretFile(repo, "direct.txt");
    const teammate = await createIdentity(path.join(root, "teammate.identity.txt"));
    await addUser(repo, { username: "teammate", recipient: teammate.recipient, signingKey: teammate.signingKey, groups: ["team"] });

    await setFileAccess(repo, "direct.txt", { groups: [], users: ["owner", "teammate"] });
    expect((await readRegistry(repo)).files[0]).toEqual({
      path: "direct.txt.gitvaulty",
      groups: [],
      users: ["owner", "teammate"],
    });
    await removeUser(repo, "teammate");
    expect((await readRegistry(repo)).files[0]!.users).toEqual(["owner"]);
    await expect(removeUser(repo, "owner")).rejects.toThrow("own user");
    await expect(setFileAccess(repo, "direct.txt", { groups: [], users: [] })).rejects.toThrow("at least one recipient");
    expect(await readFile(path.join(root, "direct.txt"), "utf8")).toBe("direct secret\n");
  }, 30_000);

  it("allows managers to revise membership while ordinary members remain read-only", async () => {
    await createGroup(repo, "dev");
    await writeFile(path.join(root, ".env.local"), "TOKEN=local\n");
    await importSecretFile(repo, ".env.local", { groups: ["dev"] });
    const alice = await createIdentity(path.join(root, "alice.identity.txt"));
    const jules = await createIdentity(path.join(root, "jules.identity.txt"));
    await addUser(repo, { username: "alice", recipient: alice.recipient, signingKey: alice.signingKey, groups: ["dev"] });
    await registerUser(repo, { username: "jules", recipient: jules.recipient, signingKey: jules.signingKey });

    process.env.GITVAULTY_KEY = alice.identity;
    const before = await readFile(path.join(root, ".env.local.gitvaulty"));
    await expect(addGroupMember(repo, "dev", "jules")).rejects.toThrow("alice is not a manager of dev");
    expect(await readFile(path.join(root, ".env.local.gitvaulty"))).toEqual(before);

    process.env.GITVAULTY_KEY = ownerIdentity;
    await addGroupManager(repo, "dev", "alice");
    process.env.GITVAULTY_KEY = alice.identity;
    await addGroupMember(repo, "dev", "jules");
    process.env.GITVAULTY_KEY = jules.identity;
    expect(await decryptSecretFile(repo, path.join(root, ".env.local.gitvaulty"))).toEqual(Buffer.from("TOKEN=local\n"));

    process.env.GITVAULTY_KEY = alice.identity;
    await removeGroupManager(repo, "dev", "owner");
    await expect(removeGroupMember(repo, "dev", "alice")).rejects.toThrow("demote the manager first");
  }, 30_000);
});
