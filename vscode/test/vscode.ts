export enum FileType {
  Unknown = 0,
  File = 1,
  Directory = 2,
  SymbolicLink = 64,
}

export enum FileChangeType {
  Changed = 1,
  Created = 2,
  Deleted = 3,
}

export class Uri {
  private constructor(
    readonly scheme: string,
    readonly authority: string,
    readonly path: string,
    readonly query: string,
  ) {}

  static from(parts: { scheme: string; authority?: string; path?: string; query?: string }): Uri {
    return new Uri(parts.scheme, parts.authority ?? "", parts.path ?? "", parts.query ?? "");
  }

  static parse(value: string): Uri {
    const parsed = new URL(value);
    return new Uri(parsed.protocol.slice(0, -1), parsed.host, decodeURIComponent(parsed.pathname), parsed.search.slice(1));
  }

  get fsPath(): string { return this.path; }

  toString(): string {
    return `${this.scheme}://${this.authority}${this.path}${this.query ? `?${this.query}` : ""}`;
  }
}

export interface Disposable { dispose(): void }

export class EventEmitter<T> implements Disposable {
  readonly #listeners = new Set<(event: T) => unknown>();
  readonly event = (listener: (event: T) => unknown): Disposable => {
    this.#listeners.add(listener);
    return { dispose: () => { this.#listeners.delete(listener); } };
  };

  fire(event: T): void { for (const listener of this.#listeners) listener(event); }

  dispose(): void { this.#listeners.clear(); }
}

export class FileSystemError extends Error {
  static FileNotFound(message?: string): FileSystemError { return new FileSystemError(message ?? "File not found"); }
  static FileNotADirectory(message?: string): FileSystemError { return new FileSystemError(message ?? "Not a directory"); }
  static NoPermissions(message?: string): FileSystemError { return new FileSystemError(message ?? "No permissions"); }
  static Unavailable(message?: string): FileSystemError { return new FileSystemError(message ?? "Unavailable"); }
}
