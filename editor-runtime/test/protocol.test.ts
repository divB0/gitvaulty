import { describe, expect, it } from "vitest";

import {
  MAX_FRAME_BYTES,
  ProtocolError,
  decodeFrames,
  encodeFrame,
  parseRequest,
  type EditorRequest,
} from "../src/protocol.js";

describe("editor runtime protocol", () => {
  it("encodes a four-byte big-endian length and decodes partial and adjacent frames", () => {
    const first = encodeFrame({ id: "one", protocolVersion: 1, method: "ping", params: {} });
    const second = encodeFrame({ id: "two", protocolVersion: 1, method: "access", params: { sourcePath: "/repo/.env.gitvaulty" } });
    expect(first.readUInt32BE(0)).toBe(first.length - 4);

    const decoder = decodeFrames<EditorRequest>();
    expect(decoder.push(first.subarray(0, 3))).toEqual([]);
    expect(decoder.push(Buffer.concat([first.subarray(3), second]))).toEqual([
      { id: "one", protocolVersion: 1, method: "ping", params: {} },
      { id: "two", protocolVersion: 1, method: "access", params: { sourcePath: "/repo/.env.gitvaulty" } },
    ]);
  });

  it("rejects oversized, malformed, and incomplete requests", () => {
    const decoder = decodeFrames<unknown>();
    const oversized = Buffer.alloc(4);
    oversized.writeUInt32BE(MAX_FRAME_BYTES + 1);
    expect(() => decoder.push(oversized)).toThrow(ProtocolError);
    expect(() => decodeFrames<unknown>().push(Buffer.from([0, 0, 0, 1, 0xff]))).toThrow(ProtocolError);
    expect(() => parseRequest({ protocolVersion: 1, method: "ping", params: {} })).toThrow("request id");
  });

  it("validates protocol versions and method parameters", () => {
    expect(() => parseRequest({ id: "1", protocolVersion: 2, method: "ping", params: {} })).toThrow("protocol version");
    expect(() => parseRequest({ id: "1", protocolVersion: 1, method: "save", params: { sourcePath: "x" } })).toThrow("plaintext");
    expect(parseRequest({ id: "1", protocolVersion: 1, method: "ping", params: {} }).method).toBe("ping");
  });
});
