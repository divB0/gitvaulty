import { access, mkdtemp, readFile, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import { createIdentity } from "../src/key.js";
import {
  createSecretFile,
  editSecretFile,
  encryptedFileFor,
  importSecretFile,
  initialize,
  plaintextFileFor,
  updateSecretFile,
} from "../src/operations.js";
import { executeChecked } from "../src/process.js";
import { readRegistry } from "../src/registry.js";
import { findRepository, type Repository } from "../src/repository.js";
import { decryptSecretFile } from "../src/sops.js";

describe("opaque native secret files", () => {
  let root: string;
  let repo: Repository;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-files-"));
    process.env.GITVAULTY_AGE_KEY_FILE = path.join(root, "identity.txt");
    await executeChecked("git", ["init", "-q"], { cwd: root });
    repo = await findRepository(root);
    const owner = await createIdentity();
    await initialize(repo, { username: "owner", recipient: owner.recipient });
  });

  it("maps arbitrary safe plaintext paths to opaque storage paths", () => {
    expect(encryptedFileFor(repo, ".env.production")).toBe(path.join(repo.root, ".env.production.gitvaulty"));
    expect(encryptedFileFor(repo, "certs/client.pem")).toBe(path.join(repo.root, "certs", "client.pem.gitvaulty"));
    expect(plaintextFileFor(repo, "certs/client.pem.gitvaulty")).toBe(path.join(repo.root, "certs", "client.pem"));
    for (const file of ["../.env", "/tmp/.env", ".git/config", ".gitvaulty/recipients.json", ".env.gitvaulty"]) {
      expect(() => encryptedFileFor(repo, file)).toThrow();
    }
  });

  it("creates only new empty encrypted files", async () => {
    expect(await createSecretFile(repo, "secrets/custom.bin")).toEqual({ file: "secrets/custom.bin" });
    const encrypted = path.join(root, "secrets", "custom.bin.gitvaulty");
    expect(await decryptSecretFile(repo, encrypted)).toEqual(Buffer.alloc(0));
    expect((await stat(encrypted)).mode & 0o777).toBe(0o600);
    expect(await readRegistry(repo)).toMatchObject({
      version: 3,
      defaultGroup: "team",
      users: [{ username: "owner" }],
      groups: [{ name: "team", members: ["owner"] }],
      files: [{ path: "secrets/custom.bin.gitvaulty", groups: ["team"], users: [] }],
    });
    await writeFile(path.join(root, ".env"), "TOKEN=secret\n");
    await expect(createSecretFile(repo, ".env")).rejects.toThrow("use `gitvaulty import .env`");
  });

  it("requires the creator to belong to an explicit file policy", async () => {
    await expect(createSecretFile(repo, "private.txt", { groups: [], users: ["missing"] })).rejects.toThrow("Unknown user");
    await expect(createSecretFile(repo, "private.txt", { groups: [], users: [] })).resolves.toEqual({ file: "private.txt" });
  });

  it("imports and verifies exact arbitrary bytes without deleting plaintext", async () => {
    const bytes = Buffer.from([0, 1, 2, 10, 65, 66, 67, 255]);
    const plaintext = path.join(root, "cert.bin");
    await writeFile(plaintext, bytes);
    expect(await importSecretFile(repo, "cert.bin")).toEqual({ file: "cert.bin", bytes: bytes.length });
    expect(await readFile(plaintext)).toEqual(bytes);
    expect((await stat(plaintext)).mode & 0o777).toBe(0o600);
    const encrypted = path.join(root, "cert.bin.gitvaulty");
    expect(await decryptSecretFile(repo, encrypted)).toEqual(bytes);
    expect((await readFile(encrypted, "utf8"))).not.toContain("ABC");
    expect(await readFile(repo.excludeFile, "utf8")).toContain("/cert.bin");
  });

  it("does not reveal dotenv keys, values, comments, or structure", async () => {
    const plaintext = "# production database\nDATABASE_URL=postgres://secret\n";
    await writeFile(path.join(root, ".env.production"), plaintext);
    await importSecretFile(repo, ".env.production");
    const stored = await readFile(path.join(root, ".env.production.gitvaulty"), "utf8");
    expect(stored).not.toContain("production database");
    expect(stored).not.toContain("DATABASE_URL");
    expect(stored).not.toContain("postgres://secret");
    expect(await decryptSecretFile(repo, path.join(root, ".env.production.gitvaulty"))).toEqual(Buffer.from(plaintext));
  });

  it("refuses tracked plaintext and symlinked paths", async () => {
    await writeFile(path.join(root, ".env"), "TOKEN=secret\n");
    await executeChecked("git", ["add", ".env"], { cwd: root });
    await expect(importSecretFile(repo, ".env")).rejects.toThrow("Git-tracked plaintext");

    const outside = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-outside-"));
    await symlink(outside, path.join(root, "linked"));
    await expect(importSecretFile(repo, "linked/file.txt")).rejects.toThrow("symbolic link");
    await expect(access(path.join(outside, "file.txt.gitvaulty"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("edits through a private plaintext file and updates an existing current materialization", async () => {
    await writeFile(path.join(root, ".env"), "TOKEN=old\n");
    await importSecretFile(repo, ".env");
    const editor = path.join(root, "editor.mjs");
    await writeFile(editor, "import{writeFileSync}from'node:fs';writeFileSync(process.argv[2],'TOKEN=new\\n')");
    const previous = process.env.EDITOR;
    process.env.EDITOR = `${process.execPath} ${editor}`;
    try { expect(await editSecretFile(repo, ".env")).toBe(true); }
    finally {
      if (previous === undefined) delete process.env.EDITOR;
      else process.env.EDITOR = previous;
    }
    expect(await readFile(path.join(root, ".env"), "utf8")).toBe("TOKEN=new\n");
    expect(await decryptSecretFile(repo, path.join(root, ".env.gitvaulty"))).toEqual(Buffer.from("TOKEN=new\n"));
  });

  it("refuses to edit over independently modified plaintext", async () => {
    await writeFile(path.join(root, ".env"), "TOKEN=old\n");
    await importSecretFile(repo, ".env");
    await writeFile(path.join(root, ".env"), "TOKEN=local\n");
    await expect(editSecretFile(repo, ".env")).rejects.toThrow("has local changes");
    const editor = path.join(root, "no-op-editor.mjs");
    await writeFile(editor, "// leave the provided file unchanged\n");
    const previous = process.env.EDITOR;
    process.env.EDITOR = `${process.execPath} ${editor}`;
    try { expect(await editSecretFile(repo, ".env", "use-local")).toBe(false); }
    finally {
      if (previous === undefined) delete process.env.EDITOR;
      else process.env.EDITOR = previous;
    }
    expect(await decryptSecretFile(repo, path.join(root, ".env.gitvaulty"))).toEqual(Buffer.from("TOKEN=local\n"));
  });

  it("explicitly updates an encrypted file from local plaintext", async () => {
    await writeFile(path.join(root, ".env"), "TOKEN=old\n");
    await importSecretFile(repo, ".env");
    await writeFile(path.join(root, ".env"), "TOKEN=new\n");
    expect(await updateSecretFile(repo, ".env")).toEqual({ file: ".env", bytes: 10 });
    expect(await decryptSecretFile(repo, path.join(root, ".env.gitvaulty"))).toEqual(Buffer.from("TOKEN=new\n"));
  });
});
