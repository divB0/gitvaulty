import {
  createPrivateKey,
  createPublicKey,
  hkdfSync,
  randomBytes,
  sign,
  verify,
  type KeyObject,
} from "node:crypto";
import { chmod, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { bech32 } from "@scure/base";
import { identityToRecipient } from "age-encryption";
import { GitVaultyError } from "./errors.js";
import { ensureParent } from "./repository.js";

const MASTER_PREFIX = "GITVAULTY-IDENTITY-";
const AGE_PREFIX = "AGE-SECRET-KEY-";
const SIGNING_PREFIX = "ed25519:";
const IDENTITY_SALT = Buffer.from("gitvaulty identity v1", "utf8");
const ED25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

export interface StoredIdentity {
  identity: string;
  ageIdentity: string;
  recipient: string;
  signingKey: string;
}

export function identityFile(
  environment: NodeJS.ProcessEnv = process.env,
  homeDirectory = os.homedir(),
  platform = process.platform,
): string {
  const override = environment.GITVAULTY_AGE_KEY_FILE ?? environment.SOPS_AGE_KEY_FILE;
  if (override) return path.resolve(override);
  if (platform === "win32" && environment.APPDATA) return path.join(environment.APPDATA, "gitvaulty", "identity");
  const config = environment.XDG_CONFIG_HOME ?? path.join(homeDirectory, ".config");
  return path.join(config, "gitvaulty", "identity");
}

function decodeMasterIdentity(identity: string): Buffer {
  try {
    const decoded = bech32.decodeToBytes(identity);
    if (
      !identity.startsWith(`${MASTER_PREFIX}1`)
      || identity !== identity.toUpperCase()
      || decoded.prefix.toUpperCase() !== MASTER_PREFIX
      || decoded.bytes.length !== 32
    ) throw new Error("invalid identity");
    return Buffer.from(decoded.bytes);
  } catch {
    throw new GitVaultyError("No valid GitVaulty master identity was found.");
  }
}

function cleanIdentity(value: string): string {
  const identities = value.split(/\s+/).map((item) => item.trim()).filter((item) => item.startsWith(`${MASTER_PREFIX}1`));
  if (identities.length !== 1) throw new GitVaultyError("No valid GitVaulty master identity was found.");
  const identity = identities[0]!;
  const decoded = decodeMasterIdentity(identity);
  decoded.fill(0);
  return identity;
}

function derivedBytes(master: Uint8Array, purpose: "encryption" | "signing"): Buffer {
  return Buffer.from(hkdfSync(
    "sha256",
    master,
    IDENTITY_SALT,
    Buffer.from(`gitvaulty/${purpose}/v1`, "utf8"),
    32,
  ));
}

function signingPrivateKey(seed: Uint8Array): KeyObject {
  return createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, Buffer.from(seed)]),
    format: "der",
    type: "pkcs8",
  });
}

function signingPublicKey(privateKey: KeyObject): string {
  const der = createPublicKey(privateKey).export({ format: "der", type: "spki" });
  const bytes = Buffer.from(der).subarray(-32);
  return `${SIGNING_PREFIX}${bytes.toString("base64url")}`;
}

function parseSigningValue(value: string, label: string, bytes: number): Buffer {
  if (!value.startsWith(SIGNING_PREFIX)) throw new GitVaultyError(`Invalid Ed25519 ${label}.`);
  const encoded = value.slice(SIGNING_PREFIX.length);
  const decoded = Buffer.from(encoded, "base64url");
  if (decoded.length !== bytes || decoded.toString("base64url") !== encoded) {
    throw new GitVaultyError(`Invalid Ed25519 ${label}.`);
  }
  return decoded;
}

function publicSigningKey(value: string): KeyObject {
  const raw = parseSigningValue(value, "public key", 32);
  const prefix = Buffer.from("302a300506032b6570032100", "hex");
  return createPublicKey({ key: Buffer.concat([prefix, raw]), format: "der", type: "spki" });
}

export function parseSigningKey(value: string): string {
  parseSigningValue(value, "public key", 32).fill(0);
  return value;
}

export async function deriveIdentity(value: string): Promise<StoredIdentity> {
  const identity = cleanIdentity(value);
  const master = decodeMasterIdentity(identity);
  const encryption = derivedBytes(master, "encryption");
  const signingSeed = derivedBytes(master, "signing");
  try {
    const ageIdentity = bech32.encodeFromBytes(AGE_PREFIX, encryption).toUpperCase();
    const recipient = await identityToRecipient(ageIdentity);
    const signingKey = signingPublicKey(signingPrivateKey(signingSeed));
    return { identity, ageIdentity, recipient, signingKey };
  } finally {
    master.fill(0);
    encryption.fill(0);
    signingSeed.fill(0);
  }
}

export async function signMessage(identity: string, message: Uint8Array): Promise<string> {
  const master = decodeMasterIdentity(cleanIdentity(identity));
  const signingSeed = derivedBytes(master, "signing");
  try {
    return `${SIGNING_PREFIX}${sign(null, message, signingPrivateKey(signingSeed)).toString("base64url")}`;
  } finally {
    master.fill(0);
    signingSeed.fill(0);
  }
}

export function verifyMessage(signingKey: string, message: Uint8Array, signature: string): boolean {
  try {
    return verify(
      null,
      message,
      publicSigningKey(signingKey),
      parseSigningValue(signature, "signature", 64),
    );
  } catch {
    return false;
  }
}

export async function readStoredIdentity(file = identityFile()): Promise<string> {
  try { return cleanIdentity(await readFile(file, "utf8")); }
  catch (error) {
    if (error instanceof GitVaultyError) throw error;
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new GitVaultyError(`No GitVaulty key found at ${file}.`);
    throw error;
  }
}

export async function readIdentity(file = identityFile(), environment: NodeJS.ProcessEnv = process.env): Promise<string> {
  if (Object.hasOwn(environment, "GITVAULTY_KEY")) return cleanIdentity(environment.GITVAULTY_KEY ?? "");
  return readStoredIdentity(file);
}

export async function currentIdentity(
  file = identityFile(),
  environment: NodeJS.ProcessEnv = process.env,
): Promise<StoredIdentity> {
  return deriveIdentity(await readIdentity(file, environment));
}

export async function restoreIdentity(value: string, file = identityFile(), replace = false): Promise<StoredIdentity> {
  const identity = cleanIdentity(value);
  const derived = await deriveIdentity(identity);
  await ensureParent(file);
  await writeFile(file, `# GitVaulty global identity\n${identity}\n`, { mode: 0o600, flag: replace ? "w" : "wx" }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "EEXIST") throw new GitVaultyError(`A GitVaulty key already exists at ${file}.`);
    throw error;
  });
  await chmod(file, 0o600);
  return derived;
}

export async function createIdentity(file = identityFile()): Promise<StoredIdentity> {
  const master = randomBytes(32);
  try {
    return restoreIdentity(bech32.encodeFromBytes(MASTER_PREFIX, master).toUpperCase(), file);
  } finally {
    master.fill(0);
  }
}

export async function currentRecipient(file = identityFile(), environment: NodeJS.ProcessEnv = process.env): Promise<string> {
  return (await currentIdentity(file, environment)).recipient;
}
