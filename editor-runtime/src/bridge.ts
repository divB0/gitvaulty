import { lstat, realpath } from "node:fs/promises";
import path from "node:path";

import { GitVaultyError, SecretFileConflictError } from "../../src/errors.js";
import { plaintextFileFor, readSecretFile, writeSecretFile } from "../../src/operations.js";
import { readRegistry, usernamesFor } from "../../src/registry.js";
import { findRepository } from "../../src/repository.js";
import {
  ProtocolError,
  decodeFrames,
  encodeFrame,
  parseRequest,
  type EditorRequest,
  type EditorResponse,
} from "./protocol.js";

const textDecoder = new TextDecoder("utf-8", { fatal: true });

export interface EditorRuntimeCore {
  open(sourcePath: string): Promise<{ logicalPath: string; plaintext: Buffer; fingerprint: string; users: string[] }>;
  save(sourcePath: string, plaintext: Buffer, expectedFingerprint: string): Promise<{ fingerprint: string }>;
  access(sourcePath: string): Promise<{ logicalPath: string; users: string[] }>;
}

function decodeText(bytes: Buffer): string {
  let text: string;
  try { text = textDecoder.decode(bytes); }
  catch { throw new InvalidTextError(); }
  if (text.includes("\0")) throw new InvalidTextError();
  return text;
}

function decodeBase64(value: string): Buffer {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new ProtocolError("Invalid base64 plaintext.");
  }
  const bytes = Buffer.from(value, "base64");
  decodeText(bytes);
  return bytes;
}

class InvalidTextError extends GitVaultyError {
  override name = "InvalidTextError";
  constructor() { super("GitVaulty native editors support UTF-8 text without NUL bytes."); }
}

async function logicalSource(sourcePath: string): Promise<{
  repo: Awaited<ReturnType<typeof findRepository>>;
  plaintext: string;
}> {
  if (!path.isAbsolute(sourcePath) || !sourcePath.endsWith(".gitvaulty")) throw new GitVaultyError("Encrypted source must be an absolute *.gitvaulty path.");
  const sourceStats = await lstat(sourcePath).catch(() => { throw new GitVaultyError("Encrypted source does not exist."); });
  if (!sourceStats.isFile() || sourceStats.isSymbolicLink()) throw new GitVaultyError("Encrypted source must be a regular file.");

  const repo = await findRepository(path.dirname(sourcePath));
  const canonicalRoot = await realpath(repo.root);
  let aliasedRoot = path.dirname(sourcePath);
  while (true) {
    if (await realpath(aliasedRoot) === canonicalRoot) break;
    const parent = path.dirname(aliasedRoot);
    if (parent === aliasedRoot) throw new GitVaultyError("Encrypted source must be inside its repository.");
    aliasedRoot = parent;
  }

  const relative = path.relative(aliasedRoot, sourcePath);
  const segments = relative.split(path.sep);
  let current = aliasedRoot;
  for (const segment of segments) {
    current = path.join(current, segment);
    if ((await lstat(current)).isSymbolicLink()) throw new GitVaultyError("Encrypted source path contains a symbolic link.");
  }
  const canonicalSource = path.join(canonicalRoot, ...segments);
  return { repo, plaintext: plaintextFileFor(repo, canonicalSource) };
}

export const gitVaultyCore: EditorRuntimeCore = {
  async open(sourcePath) {
    const { repo, plaintext } = await logicalSource(sourcePath);
    const opened = await readSecretFile(repo, plaintext);
    decodeText(opened.plaintext);
    const registry = await readRegistry(repo);
    return {
      logicalPath: opened.file,
      plaintext: opened.plaintext,
      fingerprint: opened.fingerprint,
      users: usernamesFor(registry, opened.encryptedFile),
    };
  },
  async save(sourcePath, plaintext, expectedFingerprint) {
    decodeText(plaintext);
    const resolved = await logicalSource(sourcePath);
    return writeSecretFile(resolved.repo, resolved.plaintext, plaintext, expectedFingerprint);
  },
  async access(sourcePath) {
    const { repo, plaintext } = await logicalSource(sourcePath);
    const opened = await readSecretFile(repo, plaintext);
    const registry = await readRegistry(repo);
    return { logicalPath: opened.file, users: usernamesFor(registry, opened.encryptedFile) };
  },
};

function failure(id: string, error: unknown): EditorResponse {
  if (error instanceof SecretFileConflictError) {
    return { id, ok: false, error: { code: "CONFLICT", message: error.message } };
  }
  if (error instanceof InvalidTextError) {
    return { id, ok: false, error: { code: "INVALID_TEXT", message: error.message } };
  }
  if (error instanceof ProtocolError) {
    return { id, ok: false, error: { code: "PROTOCOL_ERROR", message: error.message } };
  }
  if (error instanceof GitVaultyError) {
    return { id, ok: false, error: { code: "GITVAULTY_ERROR", message: error.message } };
  }
  return { id, ok: false, error: { code: "INTERNAL_ERROR", message: "GitVaulty editor runtime failed." } };
}

export async function handleRequest(request: EditorRequest, core: EditorRuntimeCore = gitVaultyCore): Promise<EditorResponse> {
  try {
    switch (request.method) {
      case "ping":
        return { id: request.id, ok: true, result: { protocolVersion: 1, runtimeVersion: "0.1.1" } };
      case "open": {
        const opened = await core.open(request.params.sourcePath);
        decodeText(opened.plaintext);
        return {
          id: request.id,
          ok: true,
          result: { ...opened, plaintext: opened.plaintext.toString("base64") },
        };
      }
      case "save": {
        const saved = await core.save(
          request.params.sourcePath,
          decodeBase64(request.params.plaintext),
          request.params.expectedFingerprint,
        );
        return { id: request.id, ok: true, result: saved };
      }
      case "access":
        return { id: request.id, ok: true, result: await core.access(request.params.sourcePath) };
    }
  } catch (error) {
    return failure(request.id, error);
  }
}

export async function runBridge(
  input: NodeJS.ReadableStream = process.stdin,
  output: NodeJS.WritableStream = process.stdout,
): Promise<void> {
  const decoder = decodeFrames<unknown>();
  for await (const chunk of input) {
    for (const value of decoder.push(Buffer.from(chunk as Uint8Array))) {
      let response: EditorResponse;
      try {
        const request = parseRequest(value);
        response = await handleRequest(request);
      } catch (error) {
        const id = typeof value === "object" && value !== null && typeof (value as { id?: unknown }).id === "string"
          ? (value as { id: string }).id
          : "protocol";
        response = failure(id, error);
      }
      output.write(encodeFrame(response));
    }
  }
  decoder.finish();
}
