import { Buffer } from "node:buffer";
import { GitVaultyError } from "./errors.js";

export type RecipientType = "age" | "ssh-ed25519";

export interface ParsedRecipient {
  recipient: string;
  type: RecipientType;
  suggestedUsername?: string;
}

const bech32Alphabet = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

function bech32Polymod(values: number[]): number {
  const generators = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let checksum = 1;
  for (const value of values) {
    const top = checksum >>> 25;
    checksum = ((checksum & 0x1ffffff) << 5) ^ value;
    for (const [index, generator] of generators.entries()) {
      if ((top >>> index) & 1) checksum ^= generator;
    }
  }
  return checksum >>> 0;
}

function isClassicAgeRecipient(value: string): boolean {
  if (value.length !== 62 || !value.startsWith("age1") || value !== value.toLowerCase()) return false;
  const data = [...value.slice(4)].map((character) => bech32Alphabet.indexOf(character));
  if (data.some((item) => item < 0)) return false;
  const hrp = [..."age"].map((character) => character.charCodeAt(0));
  const expanded = [...hrp.map((character) => character >>> 5), 0, ...hrp.map((character) => character & 31)];
  return bech32Polymod([...expanded, ...data]) === 1;
}

function readSshField(payload: Buffer, offset: number): { value: Buffer; offset: number } | undefined {
  if (offset + 4 > payload.length) return undefined;
  const length = payload.readUInt32BE(offset);
  const start = offset + 4;
  const end = start + length;
  if (end > payload.length) return undefined;
  return { value: payload.subarray(start, end), offset: end };
}

function parseSshEd25519(parts: string[]): ParsedRecipient {
  const encoded = parts[1] ?? "";
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new GitVaultyError("Enter a valid SSH Ed25519 public key.");
  const payload = Buffer.from(encoded, "base64");
  if (payload.toString("base64").replace(/=+$/, "") !== encoded.replace(/=+$/, "")) throw new GitVaultyError("Enter a valid SSH Ed25519 public key.");
  const algorithm = readSshField(payload, 0);
  const key = algorithm && readSshField(payload, algorithm.offset);
  if (!algorithm || !key || algorithm.value.toString("utf8") !== "ssh-ed25519" || key.value.length !== 32 || key.offset !== payload.length) {
    throw new GitVaultyError("Enter a valid SSH Ed25519 public key.");
  }

  const parsed: ParsedRecipient = { recipient: `ssh-ed25519 ${encoded}`, type: "ssh-ed25519" };
  const comment = parts.slice(2).join(" ").trim();
  if (comment) {
    const candidate = comment.split(/\s|@/, 1)[0] ?? "";
    try { parsed.suggestedUsername = normalizeUsername(candidate); }
    catch { /* comments are hints, not identity */ }
  }
  return parsed;
}

export function parseRecipient(input: string): ParsedRecipient {
  const value = input.trim();
  if (isClassicAgeRecipient(value)) return { recipient: value, type: "age" };
  const parts = value.split(/\s+/);
  if (parts[0] === "ssh-ed25519") return parseSshEd25519(parts);
  if (value.startsWith("age1")) throw new GitVaultyError("Enter a valid age recipient beginning with age1.");
  if (value.startsWith("ssh-")) throw new GitVaultyError("Only SSH Ed25519 public keys are supported.");
  throw new GitVaultyError("Enter a public age recipient (age1...) or SSH Ed25519 public key (ssh-ed25519 ...).");
}

export function normalizeUsername(input: string): string {
  const username = input.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/.test(username)) {
    throw new GitVaultyError("Enter a username using lowercase letters, numbers, '.', '_', or '-'.");
  }
  return username;
}
