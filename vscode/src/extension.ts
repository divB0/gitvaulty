import { existsSync } from "node:fs";
import path from "node:path";
import { ViewColumn, window, workspace, type ExtensionContext, type TextDocumentShowOptions } from "vscode";

import { registerEditorUx } from "./commands.js";
import { GitVaultyCore } from "./core.js";
import { GitVaultyFileSystemProvider } from "./filesystem.js";
import { GITVAULTY_EDITOR_VIEW_TYPE, GitVaultyLauncher } from "./launcher.js";
import { GITVAULTY_SCHEME } from "./uri.js";

export function activate(context: ExtensionContext): void {
  const bundledSops = path.join(context.extensionUri.fsPath, "bin", process.platform === "win32" ? "sops.exe" : "sops");
  if (process.env.GITVAULTY_SOPS === undefined && existsSync(bundledSops)) process.env.GITVAULTY_SOPS = bundledSops;
  const core = new GitVaultyCore();
  const provider = new GitVaultyFileSystemProvider(core);
  const launcher = new GitVaultyLauncher({
    openTextDocument: (uri) => workspace.openTextDocument(uri),
    async showTextDocument(document, viewColumn) {
      const options: TextDocumentShowOptions = { preview: false, preserveFocus: false };
      if (viewColumn !== undefined) options.viewColumn = viewColumn as ViewColumn;
      await window.showTextDocument(document, options);
    },
    showErrorMessage(message) { void window.showErrorMessage(message); },
  });

  const watcher = workspace.createFileSystemWatcher("**/*.gitvaulty");
  const sourceChanged = (uri: Parameters<typeof provider.sourceChanged>[0] | { toString(): string }): void => {
    provider.sourceChanged(typeof uri === "string" ? uri : uri.toString());
  };

  context.subscriptions.push(
    provider,
    workspace.registerFileSystemProvider(GITVAULTY_SCHEME, provider, {
      isCaseSensitive: process.platform !== "win32",
      isReadonly: false,
    }),
    window.registerCustomEditorProvider(GITVAULTY_EDITOR_VIEW_TYPE, launcher, {
      supportsMultipleEditorsPerDocument: false,
      webviewOptions: { retainContextWhenHidden: false },
    }),
    watcher,
    watcher.onDidChange(sourceChanged),
    watcher.onDidCreate(sourceChanged),
    watcher.onDidDelete(sourceChanged),
    workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.scheme === GITVAULTY_SCHEME) provider.setDirty(event.document.uri, event.document.isDirty);
    }),
    workspace.onDidSaveTextDocument((document) => {
      if (document.uri.scheme === GITVAULTY_SCHEME) provider.setDirty(document.uri, false);
    }),
    workspace.onDidCloseTextDocument((document) => {
      if (document.uri.scheme !== GITVAULTY_SCHEME) return;
      const session = provider.sessions.byVirtualUri(document.uri.toString());
      if (session) provider.sessions.delete(session);
    }),
  );

  registerEditorUx(context, provider, core);
}
