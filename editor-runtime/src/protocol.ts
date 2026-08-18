export const PROTOCOL_VERSION = 1;
export const MAX_FRAME_BYTES = 64 * 1024 * 1024;

export class ProtocolError extends Error {
  override name = "ProtocolError";
}

export type EditorMethod = "ping" | "open" | "save" | "access";

export interface PingRequest {
  id: string;
  protocolVersion: 1;
  method: "ping";
  params: Record<string, never>;
}

export interface OpenRequest {
  id: string;
  protocolVersion: 1;
  method: "open";
  params: { sourcePath: string };
}

export interface SaveRequest {
  id: string;
  protocolVersion: 1;
  method: "save";
  params: { sourcePath: string; plaintext: string; expectedFingerprint: string };
}

export interface AccessRequest {
  id: string;
  protocolVersion: 1;
  method: "access";
  params: { sourcePath: string };
}

export type EditorRequest = PingRequest | OpenRequest | SaveRequest | AccessRequest;

export interface EditorError {
  code: "CONFLICT" | "GITVAULTY_ERROR" | "INTERNAL_ERROR" | "INVALID_TEXT" | "PROTOCOL_ERROR";
  message: string;
}

export type EditorResponse =
  | { id: string; ok: true; result: unknown }
  | { id: string; ok: false; error: EditorError };

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ProtocolError(`Invalid ${label}.`);
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) throw new ProtocolError(`Invalid ${label}.`);
  return value;
}

export function parseRequest(value: unknown): EditorRequest {
  const request = record(value, "request");
  const id = requiredString(request.id, "request id");
  if (request.protocolVersion !== PROTOCOL_VERSION) throw new ProtocolError("Unsupported protocol version.");
  const method = requiredString(request.method, "request method") as EditorMethod;
  const params = record(request.params, "request parameters");

  switch (method) {
    case "ping":
      return { id, protocolVersion: 1, method, params: {} };
    case "open":
    case "access":
      return { id, protocolVersion: 1, method, params: { sourcePath: requiredString(params.sourcePath, "source path") } };
    case "save":
      return {
        id,
        protocolVersion: 1,
        method,
        params: {
          sourcePath: requiredString(params.sourcePath, "source path"),
          plaintext: requiredString(params.plaintext, "plaintext"),
          expectedFingerprint: requiredString(params.expectedFingerprint, "expected fingerprint"),
        },
      };
    default:
      throw new ProtocolError("Unsupported request method.");
  }
}

export function encodeFrame(value: unknown): Buffer {
  const payload = Buffer.from(JSON.stringify(value), "utf8");
  if (payload.length > MAX_FRAME_BYTES) throw new ProtocolError("Protocol frame is too large.");
  const frame = Buffer.allocUnsafe(payload.length + 4);
  frame.writeUInt32BE(payload.length, 0);
  payload.copy(frame, 4);
  return frame;
}

export interface FrameDecoder<T> {
  push(chunk: Buffer): T[];
  finish(): void;
}

export function decodeFrames<T>(): FrameDecoder<T> {
  let buffered = Buffer.alloc(0);
  const decoder = new TextDecoder("utf-8", { fatal: true });

  return {
    push(chunk: Buffer): T[] {
      if (chunk.length > 0) buffered = Buffer.concat([buffered, chunk]);
      const values: T[] = [];
      while (buffered.length >= 4) {
        const length = buffered.readUInt32BE(0);
        if (length > MAX_FRAME_BYTES) throw new ProtocolError("Protocol frame is too large.");
        if (buffered.length < length + 4) break;
        const bytes = buffered.subarray(4, length + 4);
        buffered = buffered.subarray(length + 4);
        try {
          values.push(JSON.parse(decoder.decode(bytes)) as T);
        } catch {
          throw new ProtocolError("Protocol frame is not valid UTF-8 JSON.");
        }
      }
      return values;
    },
    finish(): void {
      if (buffered.length !== 0) throw new ProtocolError("Protocol stream ended with an incomplete frame.");
    },
  };
}
