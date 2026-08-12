import { describe, expect, it } from "vitest";
import { FileChangeType, FileType, Uri } from "vscode";

import {
  GitVaultyFileSystemProvider,
  type CoreReadResult,
  type CoreSaveResult,
  type SecretDocumentCore,
  type SecretSource,
} from "../src/filesystem.js";
import { SessionStore } from "../src/session.js";
import { sourceToVirtualParts } from "../src/uri.js";

function virtualUri(source = Uri.parse("file:///repo/.env.gitvaulty")): Uri {
  return Uri.from(sourceToVirtualParts({ scheme: source.scheme, path: source.path, value: source.toString() }));
}

class FakeCore implements SecretDocumentCore {
  contents: Uint8Array<ArrayBufferLike> = new TextEncoder().encode("TOKEN=old\n");
  fingerprint = "a".repeat(64);
  writes: Array<{ contents: string; expected: string }> = [];
  activeWrites = 0;
  maxActiveWrites = 0;
  writeError: Error | undefined;

  async stat(_source: SecretSource): Promise<{ ctime: number; mtime: number; size: number }> {
    return { ctime: 10, mtime: 20, size: 30 };
  }

  async read(_source: SecretSource): Promise<CoreReadResult> {
    return { file: ".env", plaintext: this.contents, fingerprint: this.fingerprint };
  }

  async write(_source: SecretSource, contents: Uint8Array, expectedFingerprint: string): Promise<CoreSaveResult> {
    this.activeWrites += 1;
    this.maxActiveWrites = Math.max(this.maxActiveWrites, this.activeWrites);
    await Promise.resolve();
    try {
      if (this.writeError) throw this.writeError;
      this.writes.push({ contents: new TextDecoder().decode(contents), expected: expectedFingerprint });
      this.contents = contents;
      this.fingerprint = String.fromCharCode(98 + this.writes.length - 1).repeat(64);
      return { fingerprint: this.fingerprint };
    } finally {
      this.activeWrites -= 1;
    }
  }

  isConflict(error: unknown): boolean { return error instanceof Error && error.name === "SecretFileConflictError"; }
}

describe("GitVaulty virtual filesystem", () => {
  it("reads and writes through the guarded core while updating metadata", async () => {
    const core = new FakeCore();
    const provider = new GitVaultyFileSystemProvider(core, new SessionStore());
    const uri = virtualUri();

    await expect(provider.stat(uri)).resolves.toEqual({ type: FileType.File, ctime: 10, mtime: 20, size: 30 });
    await expect(provider.readFile(uri)).resolves.toEqual(core.contents);
    await provider.writeFile(uri, new TextEncoder().encode("TOKEN=new\n"), { create: false, overwrite: true });

    expect(core.writes).toEqual([{ contents: "TOKEN=new\n", expected: "a".repeat(64) }]);
    expect(provider.sessions.byVirtualUri(uri.toString())?.fingerprint).toBe("b".repeat(64));
  });

  it("rejects non-text decrypted content before exposing it", async () => {
    const core = new FakeCore();
    core.contents = Uint8Array.from([0xc3, 0x28]);
    const provider = new GitVaultyFileSystemProvider(core, new SessionStore());

    await expect(provider.readFile(virtualUri())).rejects.toThrow("UTF-8");
  });

  it("serializes overlapping saves and chains each new fingerprint", async () => {
    const core = new FakeCore();
    const provider = new GitVaultyFileSystemProvider(core, new SessionStore());
    const uri = virtualUri();
    await provider.readFile(uri);

    await Promise.all([
      provider.writeFile(uri, new TextEncoder().encode("one"), { create: false, overwrite: true }),
      provider.writeFile(uri, new TextEncoder().encode("two"), { create: false, overwrite: true }),
    ]);

    expect(core.maxActiveWrites).toBe(1);
    expect(core.writes.map((write) => write.expected)).toEqual(["a".repeat(64), "b".repeat(64)]);
  });

  it("preserves the fingerprint and reports failed writes", async () => {
    const core = new FakeCore();
    const provider = new GitVaultyFileSystemProvider(core, new SessionStore());
    const uri = virtualUri();
    await provider.readFile(uri);
    core.writeError = new Error("encryption failed");

    await expect(provider.writeFile(uri, new TextEncoder().encode("new"), { create: false, overwrite: true })).rejects.toThrow("encryption failed");
    expect(provider.sessions.byVirtualUri(uri.toString())?.fingerprint).toBe("a".repeat(64));
  });

  it("reloads clean external changes and surfaces dirty ones as conflicts", async () => {
    const core = new FakeCore();
    const provider = new GitVaultyFileSystemProvider(core, new SessionStore());
    const uri = virtualUri();
    await provider.readFile(uri);
    const fileChanges: unknown[] = [];
    const conflicts: unknown[] = [];
    provider.onDidChangeFile((event) => fileChanges.push(event));
    provider.onDidConflict((event) => conflicts.push(event));

    expect(provider.sourceChanged("file:///repo/.env.gitvaulty")).toBe("reload");
    expect(fileChanges).toEqual([[{ type: FileChangeType.Changed, uri }]]);
    provider.setDirty(uri, true);
    expect(provider.sourceChanged("file:///repo/.env.gitvaulty")).toBe("conflict");
    expect(conflicts).toEqual([{ sourceUri: "file:///repo/.env.gitvaulty", virtualUri: uri }]);
  });
});
