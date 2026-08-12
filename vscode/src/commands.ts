import {
  StatusBarAlignment,
  Uri,
  commands,
  env,
  window,
  workspace,
  type Disposable,
  type ExtensionContext,
  type TextDocument,
} from "vscode";

import type { GitVaultyCore } from "./core.js";
import { GitVaultyFileSystemProvider, type SecretSource, type SourceConflictEvent } from "./filesystem.js";
import { encodeSecretText } from "./text.js";
import { GITVAULTY_SCHEME, sourceUriFromVirtual } from "./uri.js";

export const COPY_ENCRYPTED_PATH_COMMAND = "gitvaulty.copyEncryptedPath";
export const RELOAD_COMMAND = "gitvaulty.reload";
export const SHOW_ACCESS_COMMAND = "gitvaulty.showAccess";

export function sourceUriForVirtual(uri: Uri): Uri { return Uri.parse(sourceUriFromVirtual(uri)); }

function activeDocument(): TextDocument | undefined {
  const document = window.activeTextEditor?.document;
  return document?.uri.scheme === GITVAULTY_SCHEME ? document : undefined;
}

function sourceFor(document: TextDocument): SecretSource {
  const source = sourceUriForVirtual(document.uri);
  return { uri: source.toString(), fsPath: source.fsPath };
}

async function reloadDocument(provider: GitVaultyFileSystemProvider, document: TextDocument): Promise<void> {
  provider.setDirty(document.uri, false);
  const session = provider.sessions.byVirtualUri(document.uri.toString());
  if (session) provider.sourceChanged(session.sourceUri);
  await window.showTextDocument(document, { preview: false, preserveFocus: false });
  await commands.executeCommand("workbench.action.files.revert");
}

async function exportDocument(document: TextDocument): Promise<void> {
  const destination = await window.showSaveDialog({ saveLabel: "Save decrypted copy" });
  if (!destination) return;
  const source = sourceUriForVirtual(document.uri);
  if (destination.toString() === source.toString() || destination.path.endsWith(".gitvaulty")) {
    await window.showErrorMessage("Choose a non-.gitvaulty destination for the decrypted copy.");
    return;
  }
  await workspace.fs.writeFile(destination, encodeSecretText(document.getText()));
  await window.showInformationMessage(`Saved decrypted copy to ${destination.fsPath}.`);
}

export function registerEditorUx(
  context: ExtensionContext,
  provider: GitVaultyFileSystemProvider,
  core: GitVaultyCore,
): void {
  const status = window.createStatusBarItem(StatusBarAlignment.Right, 100);
  status.name = "GitVaulty";
  status.text = "$(lock) GitVaulty";
  status.tooltip = "This document is decrypted in VS Code and encrypted when saved.";
  status.command = SHOW_ACCESS_COMMAND;

  const updateStatus = (): void => {
    if (activeDocument()) status.show();
    else status.hide();
  };
  updateStatus();

  const registrations: Disposable[] = [
    status,
    window.onDidChangeActiveTextEditor(updateStatus),
    commands.registerCommand(COPY_ENCRYPTED_PATH_COMMAND, async () => {
      const document = activeDocument();
      if (!document) return;
      const source = sourceUriForVirtual(document.uri);
      await env.clipboard.writeText(source.fsPath);
      await window.showInformationMessage(`Copied encrypted path: ${source.fsPath}`);
    }),
    commands.registerCommand(RELOAD_COMMAND, async () => {
      const document = activeDocument();
      if (document) await reloadDocument(provider, document);
    }),
    commands.registerCommand(SHOW_ACCESS_COMMAND, async () => {
      const document = activeDocument();
      if (!document) return;
      try {
        const access = await core.access(sourceFor(document));
        await window.showInformationMessage(`${access.file} access: ${access.users.join(", ")}`);
      } catch (error) {
        await window.showErrorMessage(error instanceof Error ? error.message : String(error));
      }
    }),
  ];

  const pendingConflicts = new Set<string>();
  registrations.push(provider.onDidConflict((event: SourceConflictEvent) => {
    const key = event.virtualUri.toString();
    if (pendingConflicts.has(key)) return;
    pendingConflicts.add(key);
    void (async () => {
      try {
        const document = workspace.textDocuments.find((candidate) => candidate.uri.toString() === key);
        if (!document) return;
        const choice = await window.showWarningMessage(
          `${document.uri.path.split("/").at(-1) ?? document.uri.path} changed outside VS Code.`,
          "Reload encrypted version",
          "Save decrypted copy elsewhere",
        );
        if (choice === "Reload encrypted version") await reloadDocument(provider, document);
        else if (choice === "Save decrypted copy elsewhere") await exportDocument(document);
      } finally {
        pendingConflicts.delete(key);
      }
    })();
  }));

  context.subscriptions.push(...registrations);
}
