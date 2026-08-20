import assert from "node:assert/strict";
import { access, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { commands, Range, Uri, window, workspace, WorkspaceEdit } from "vscode";

import {
  createIdentity,
  findRepository,
  importSecretFile,
  initialize,
} from "../../../../src/index.js";
import { executeChecked } from "../../../../src/process.js";
import { decryptSecretFile } from "../../../../src/sops.js";

async function waitFor<T>(read: () => T | undefined, message: string): Promise<T> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const value = read();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(message);
}

export async function runEditorTest(): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-vscode-test-"));
  const encrypted = path.join(root, ".env.gitvaulty");
  try {
    process.env.GITVAULTY_AGE_KEY_FILE = path.join(root, "identity.txt");
    await executeChecked("git", ["init", "-q"], { cwd: root });
    const repo = await findRepository(root);
    const owner = await createIdentity();
    await initialize(repo, {
      username: "owner",
      recipient: owner.recipient,
      signingKey: owner.signingKey,
    });
    await writeFile(path.join(root, ".env"), "TOKEN=old\n");
    await importSecretFile(repo, ".env");
    await unlink(path.join(root, ".env"));

    await commands.executeCommand("vscode.openWith", Uri.file(encrypted), "gitvaulty.editor");
    const editor = await waitFor(
      () => window.activeTextEditor?.document.uri.scheme === "gitvaulty" ? window.activeTextEditor : undefined,
      "The GitVaulty virtual editor did not open.",
    );
    const document = editor.document;
    assert.equal(document.uri.path.endsWith("/.env"), true);
    assert.equal(document.getText(), "TOKEN=old\n");

    const edit = new WorkspaceEdit();
    edit.replace(document.uri, new Range(document.positionAt(0), document.positionAt(document.getText().length)), "TOKEN=new\n");
    assert.equal(await workspace.applyEdit(edit), true);
    assert.equal(await document.save(), true);

    assert.deepEqual(await decryptSecretFile(repo, encrypted), Buffer.from("TOKEN=new\n"));
    await assert.rejects(access(path.join(root, ".env")), { code: "ENOENT" });
  } finally {
    await commands.executeCommand("workbench.action.closeAllEditors");
    await rm(root, { recursive: true, force: true });
  }
}
