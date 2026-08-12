import {
  EventEmitter,
  FileChangeType,
  FileSystemError,
  FileType,
  Uri,
  type Disposable,
  type FileChangeEvent,
  type FileStat,
  type FileSystemProvider,
} from "vscode";

import { decodeSecretText } from "./text.js";
import { SessionStore, type DocumentSession } from "./session.js";
import { sourceUriFromVirtual } from "./uri.js";

export interface SecretSource {
  uri: string;
  fsPath: string;
}

export interface CoreReadResult {
  file: string;
  plaintext: Uint8Array;
  fingerprint: string;
}

export interface CoreSaveResult {
  fingerprint: string;
}

export interface SecretDocumentCore {
  stat(source: SecretSource): Promise<{ ctime: number; mtime: number; size: number }>;
  read(source: SecretSource): Promise<CoreReadResult>;
  write(source: SecretSource, contents: Uint8Array, expectedFingerprint: string): Promise<CoreSaveResult>;
  isConflict(error: unknown): boolean;
}

export interface SourceConflictEvent {
  sourceUri: string;
  virtualUri: Uri;
}

interface ResolvedSession {
  session: DocumentSession;
  source: SecretSource;
}

export class GitVaultyFileSystemProvider implements FileSystemProvider, Disposable {
  readonly #changes = new EventEmitter<FileChangeEvent[]>();
  readonly #conflicts = new EventEmitter<SourceConflictEvent>();
  readonly onDidChangeFile = this.#changes.event;
  readonly onDidConflict = this.#conflicts.event;

  constructor(
    readonly core: SecretDocumentCore,
    readonly sessions = new SessionStore(),
  ) {}

  watch(_uri: Uri, _options: { recursive: boolean; excludes: string[] }): Disposable {
    return { dispose() { /* Source files are watched by the extension host. */ } };
  }

  async stat(uri: Uri): Promise<FileStat> {
    const { source } = this.#resolve(uri);
    try {
      const result = await this.core.stat(source);
      return { type: FileType.File, ...result };
    } catch (error) {
      throw this.#fileSystemError(error);
    }
  }

  async readFile(uri: Uri): Promise<Uint8Array> {
    const { session, source } = this.#resolve(uri);
    try {
      const opened = await this.core.read(source);
      decodeSecretText(opened.plaintext);
      session.logicalPath = opened.file;
      session.fingerprint = opened.fingerprint;
      session.dirty = false;
      return opened.plaintext;
    } catch (error) {
      throw this.#fileSystemError(error);
    }
  }

  async writeFile(uri: Uri, contents: Uint8Array, _options: { create: boolean; overwrite: boolean }): Promise<void> {
    decodeSecretText(contents);
    const { session, source } = this.#resolve(uri);
    const save = session.saveQueue.catch(() => undefined).then(async () => {
      if (session.fingerprint === undefined) {
        throw FileSystemError.Unavailable("Reload the GitVaulty document before saving it.");
      }
      try {
        const saved = await this.core.write(source, contents, session.fingerprint);
        session.fingerprint = saved.fingerprint;
        session.dirty = false;
      } catch (error) {
        if (this.core.isConflict(error)) this.#conflicts.fire({ sourceUri: session.sourceUri, virtualUri: uri });
        throw this.#fileSystemError(error);
      }
    });
    session.saveQueue = save.then(() => undefined, () => undefined);
    await save;
  }

  readDirectory(_uri: Uri): [string, FileType][] { throw FileSystemError.FileNotADirectory(); }

  createDirectory(_uri: Uri): void { throw FileSystemError.NoPermissions("GitVaulty virtual documents cannot create directories."); }

  delete(_uri: Uri, _options: { recursive: boolean }): void {
    throw FileSystemError.NoPermissions("Delete the encrypted file from the repository instead.");
  }

  rename(_oldUri: Uri, _newUri: Uri, _options: { overwrite: boolean }): void {
    throw FileSystemError.NoPermissions("Rename the encrypted file from the repository instead.");
  }

  setDirty(uri: Uri, dirty: boolean): void {
    const session = this.sessions.byVirtualUri(uri.toString());
    if (session) session.dirty = dirty;
  }

  sourceChanged(sourceUri: string): "reload" | "conflict" | undefined {
    const session = this.sessions.bySourceUri(sourceUri);
    if (!session) return undefined;
    const virtualUri = Uri.parse(session.virtualUri);
    if (session.dirty) {
      this.#conflicts.fire({ sourceUri, virtualUri });
      return "conflict";
    }
    session.fingerprint = undefined;
    this.#changes.fire([{ type: FileChangeType.Changed, uri: virtualUri }]);
    return "reload";
  }

  dispose(): void {
    this.#changes.dispose();
    this.#conflicts.dispose();
  }

  #resolve(uri: Uri): ResolvedSession {
    let sourceUri: string;
    try { sourceUri = sourceUriFromVirtual(uri); }
    catch (error) { throw FileSystemError.FileNotFound(error instanceof Error ? error.message : String(error)); }
    const parsed = Uri.parse(sourceUri);
    const canonicalSource = parsed.toString();
    return {
      session: this.sessions.getOrCreate({
        sourceUri: canonicalSource,
        virtualUri: uri.toString(),
        logicalPath: uri.path,
      }),
      source: { uri: canonicalSource, fsPath: parsed.fsPath },
    };
  }

  #fileSystemError(error: unknown): FileSystemError {
    if (error instanceof FileSystemError) return error;
    return FileSystemError.Unavailable(error instanceof Error ? error.message : String(error));
  }
}
