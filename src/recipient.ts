import { GitVaultyError } from "./errors.js";

const bech32Alphabet = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

function bech32Polymod(values: number[]): number {
  const generators = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let checksum = 1;
  for (const value of values) {
    const top = checksum >>> 25;
    checksum = ((checksum & 0x1ffffff) << 5) ^ value;
    for (const [index, generator] of generators.entries()) if ((top >>> index) & 1) checksum ^= generator;
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

export function parseRecipient(input: string): string {
  const value = input.trim();
  if (!isClassicAgeRecipient(value)) throw new GitVaultyError("Enter a valid public age recipient beginning with age1.");
  return value;
}

export function normalizeUsername(input: string): string {
  const username = input.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/.test(username)) {
    throw new GitVaultyError("Enter a username using lowercase letters, numbers, '.', '_', or '-'.");
  }
  return username;
}
