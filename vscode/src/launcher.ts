import { Uri, type TextDocument } from "vscode";

import { sourceToVirtualParts } from "./uri.js";

export const GITVAULTY_EDITOR_VIEW_TYPE = "gitvaulty.editor";

export interface LauncherDocument {
  readonly uri: Uri;
  dispose(): void;
}

export interface LauncherPanel {
  readonly viewColumn: number | undefined;
  readonly webview: { html: string };
  dispose(): void;
}

export interface LauncherHost {
  openTextDocument(uri: Uri): Thenable<TextDocument>;
  showTextDocument(document: TextDocument, viewColumn: number | undefined): Thenable<void>;
  showErrorMessage(message: string): void;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function loadingHtml(filename: string): string {
  return `<!doctype html><html><body><p>Decrypting <strong>${escapeHtml(filename)}</strong>…</p></body></html>`;
}

const errorHtml = "<!doctype html><html><body><p>Could not open this GitVaulty file.</p><p>See the notification for details.</p></body></html>";

export class GitVaultyLauncher {
  readonly #opening = new Map<string, Thenable<TextDocument>>();

  constructor(readonly host: LauncherHost) {}

  async openCustomDocument(uri: Uri): Promise<LauncherDocument> {
    return { uri, dispose() { /* The launcher holds no document resources. */ } };
  }

  async resolveCustomEditor(document: LauncherDocument, panel: LauncherPanel): Promise<void> {
    panel.webview.html = loadingHtml(document.uri.path.split("/").at(-1) ?? document.uri.path);
    try {
      const virtual = Uri.from(sourceToVirtualParts({
        scheme: document.uri.scheme,
        path: document.uri.path,
        value: document.uri.toString(),
      }));
      const key = document.uri.toString();
      let opening = this.#opening.get(key);
      if (!opening) {
        opening = this.host.openTextDocument(virtual);
        this.#opening.set(key, opening);
        const clear = (): void => { if (this.#opening.get(key) === opening) this.#opening.delete(key); };
        opening.then(clear, clear);
      }
      const plaintext = await opening;
      await this.host.showTextDocument(plaintext, panel.viewColumn);
      panel.dispose();
    } catch (error) {
      panel.webview.html = errorHtml;
      this.host.showErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }
}
