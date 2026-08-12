import { describe, expect, it } from "vitest";
import { Uri, type TextDocument } from "vscode";

import { GitVaultyLauncher, type LauncherHost } from "../src/launcher.js";

function panel(viewColumn = 2) {
  return {
    viewColumn,
    webview: { html: "" },
    disposed: false,
    dispose() { this.disposed = true; },
  };
}

function host(options: { error?: Error; gate?: Promise<void> } = {}) {
  const opened: Uri[] = [];
  const shown: Array<{ document: TextDocument; viewColumn: number | undefined }> = [];
  const errors: string[] = [];
  const api: LauncherHost = {
    async openTextDocument(uri) {
      opened.push(uri);
      await options.gate;
      if (options.error) throw options.error;
      return { uri } as TextDocument;
    },
    async showTextDocument(document, viewColumn) { shown.push({ document, viewColumn }); },
    showErrorMessage(message) { errors.push(message); },
  };
  return { api, opened, shown, errors };
}

describe("GitVaulty custom editor launcher", () => {
  it("replaces ciphertext with a native plaintext-shaped virtual document", async () => {
    const calls = host();
    const launcher = new GitVaultyLauncher(calls.api);
    const source = Uri.parse("file:///repo/config/secrets.yaml.gitvaulty");
    const document = await launcher.openCustomDocument(source);
    const editor = panel();

    await launcher.resolveCustomEditor(document, editor);

    expect(calls.opened).toHaveLength(1);
    expect(calls.opened[0]).toMatchObject({
      scheme: "gitvaulty",
      path: "/repo/config/secrets.yaml",
    });
    expect(calls.shown).toEqual([{ document: { uri: calls.opened[0] }, viewColumn: 2 }]);
    expect(editor.disposed).toBe(true);
    expect(editor.webview.html).toContain("Decrypting");
  });

  it("deduplicates concurrent decryption opens for the same ciphertext", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const calls = host({ gate });
    const launcher = new GitVaultyLauncher(calls.api);
    const source = Uri.parse("file:///repo/.env.gitvaulty");
    const first = panel(1);
    const second = panel(2);

    const opening = Promise.all([
      launcher.resolveCustomEditor(await launcher.openCustomDocument(source), first),
      launcher.resolveCustomEditor(await launcher.openCustomDocument(source), second),
    ]);
    await Promise.resolve();
    expect(calls.opened).toHaveLength(1);
    release();
    await opening;

    expect(first.disposed).toBe(true);
    expect(second.disposed).toBe(true);
  });

  it("keeps a safe error panel when authorization or decryption fails", async () => {
    const calls = host({ error: new Error("Your key is not authorized for .env.") });
    const launcher = new GitVaultyLauncher(calls.api);
    const editor = panel();

    await launcher.resolveCustomEditor(
      await launcher.openCustomDocument(Uri.parse("file:///repo/.env.gitvaulty")),
      editor,
    );

    expect(editor.disposed).toBe(false);
    expect(editor.webview.html).toContain("Could not open this GitVaulty file");
    expect(editor.webview.html).not.toContain("Your key");
    expect(calls.errors).toEqual(["Your key is not authorized for .env."]);
  });
});
