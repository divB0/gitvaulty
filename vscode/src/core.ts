import { lstat } from "node:fs/promises";
import path from "node:path";

import {
  GitVaultyError,
  SecretFileConflictError,
  findRepository,
  plaintextFileFor,
  readSecretFile,
  readRegistry,
  usernamesFor,
  writeSecretFile,
} from "../../src/index.js";

import type { SecretDocumentCore, SecretSource } from "./filesystem.js";

async function logicalFile(source: SecretSource): Promise<{
  repo: Awaited<ReturnType<typeof findRepository>>;
  plaintext: string;
}> {
  const repo = await findRepository(path.dirname(source.fsPath));
  return { repo, plaintext: plaintextFileFor(repo, source.fsPath) };
}

export class GitVaultyCore implements SecretDocumentCore {
  async stat(source: SecretSource): Promise<{ ctime: number; mtime: number; size: number }> {
    const stats = await lstat(source.fsPath);
    if (!stats.isFile() || stats.isSymbolicLink()) throw new GitVaultyError("Encrypted source must be a regular file.");
    return { ctime: stats.ctimeMs, mtime: stats.mtimeMs, size: stats.size };
  }

  async read(source: SecretSource) {
    const { repo, plaintext } = await logicalFile(source);
    const opened = await readSecretFile(repo, plaintext);
    return { file: opened.file, plaintext: opened.plaintext, fingerprint: opened.fingerprint };
  }

  async write(source: SecretSource, contents: Uint8Array, expectedFingerprint: string) {
    const { repo, plaintext } = await logicalFile(source);
    return writeSecretFile(repo, plaintext, Buffer.from(contents), expectedFingerprint);
  }

  async access(source: SecretSource): Promise<{ file: string; users: string[] }> {
    const { repo, plaintext } = await logicalFile(source);
    const opened = await readSecretFile(repo, plaintext);
    const registry = await readRegistry(repo);
    return { file: opened.file, users: usernamesFor(registry, opened.encryptedFile) };
  }

  isConflict(error: unknown): boolean { return error instanceof SecretFileConflictError; }
}
