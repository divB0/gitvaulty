import { describe, expect, it, vi } from "vitest";

import { SecretFileConflictError } from "../../src/errors.js";
import { handleRequest, type EditorRuntimeCore } from "../src/bridge.js";

const sourcePath = "/repo/.env.gitvaulty";

function core(overrides: Partial<EditorRuntimeCore> = {}): EditorRuntimeCore {
  return {
    open: vi.fn(async () => ({
      logicalPath: ".env",
      plaintext: Buffer.from("TOKEN=secret\n"),
      fingerprint: "a".repeat(64),
      users: ["andrea"],
    })),
    save: vi.fn(async () => ({ fingerprint: "b".repeat(64) })),
    access: vi.fn(async () => ({ logicalPath: ".env", users: ["andrea"] })),
    ...overrides,
  };
}

describe("editor runtime bridge", () => {
  it("reports the packaged runtime version", async () => {
    const response = await handleRequest({ id: "ping-1", protocolVersion: 1, method: "ping", params: {} }, core());
    expect(response).toEqual({
      id: "ping-1",
      ok: true,
      result: { protocolVersion: 1, runtimeVersion: "0.1.1" },
    });
  });

  it("opens text as base64 and never changes the request id", async () => {
    const result = await handleRequest({ id: "open-1", protocolVersion: 1, method: "open", params: { sourcePath } }, core());
    expect(result).toEqual({
      id: "open-1",
      ok: true,
      result: {
        logicalPath: ".env",
        plaintext: Buffer.from("TOKEN=secret\n").toString("base64"),
        fingerprint: "a".repeat(64),
        users: ["andrea"],
      },
    });
  });

  it("passes exact save bytes and fingerprint to the core", async () => {
    const adapter = core();
    const response = await handleRequest({
      id: "save-1",
      protocolVersion: 1,
      method: "save",
      params: {
        sourcePath,
        plaintext: Buffer.from("TOKEN=updated\n").toString("base64"),
        expectedFingerprint: "a".repeat(64),
      },
    }, adapter);
    expect(adapter.save).toHaveBeenCalledWith(sourcePath, Buffer.from("TOKEN=updated\n"), "a".repeat(64));
    expect(response).toEqual({ id: "save-1", ok: true, result: { fingerprint: "b".repeat(64) } });
  });

  it("rejects invalid text and maps conflicts without echoing plaintext", async () => {
    const invalid = await handleRequest({ id: "invalid", protocolVersion: 1, method: "open", params: { sourcePath } }, core({
      open: vi.fn(async () => ({ logicalPath: ".env", plaintext: Buffer.from([0xff]), fingerprint: "a".repeat(64), users: [] })),
    }));
    expect(invalid).toMatchObject({ id: "invalid", ok: false, error: { code: "INVALID_TEXT" } });

    const conflict = await handleRequest({
      id: "conflict",
      protocolVersion: 1,
      method: "save",
      params: { sourcePath, plaintext: Buffer.from("TOP SECRET").toString("base64"), expectedFingerprint: "a".repeat(64) },
    }, core({ save: vi.fn(async () => { throw new SecretFileConflictError(".env"); }) }));
    expect(conflict).toMatchObject({ id: "conflict", ok: false, error: { code: "CONFLICT" } });
    expect(JSON.stringify(conflict)).not.toContain("TOP SECRET");
  });
});
