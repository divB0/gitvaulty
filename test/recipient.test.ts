import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";

import { normalizeUsername, parseRecipient } from "../src/recipient.js";

const ageRecipient = "age1nx73yf2gmghjapkvxzkx26z72uakmnppchya8d4xfjd67hhglqdq7swsm0";

function sshEd25519(key = Buffer.alloc(32, 7)): string {
  const field = (value: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(value.length);
    return Buffer.concat([length, value]);
  };
  return `ssh-ed25519 ${Buffer.concat([field(Buffer.from("ssh-ed25519")), field(key)]).toString("base64")}`;
}

describe("recipient parsing", () => {
  it("validates native age recipients", () => {
    expect(parseRecipient(ageRecipient)).toEqual({ recipient: ageRecipient, type: "age" });
    expect(() => parseRecipient(`${ageRecipient.slice(0, -1)}q`)).toThrow("valid age recipient");
  });

  it("normalizes SSH Ed25519 recipients and suggests a username", () => {
    const recipient = sshEd25519();
    expect(parseRecipient(`${recipient} Alice@workstation`)).toEqual({
      recipient,
      type: "ssh-ed25519",
      suggestedUsername: "alice",
    });
  });

  it("rejects unsupported and malformed public keys", () => {
    expect(() => parseRecipient("AGE-SECRET-KEY-1EXAMPLE")).toThrow("public");
    expect(() => parseRecipient("ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ==")).toThrow("SSH Ed25519");
    expect(() => parseRecipient("ssh-ed25519 bm90LWFuLXNzaC1rZXk=")).toThrow("valid SSH Ed25519");
  });
});

describe("username normalization", () => {
  it("normalizes lowercase handles", () => {
    expect(normalizeUsername(" Alice.Smith ")).toBe("alice.smith");
    expect(normalizeUsername("backend_bot-2")).toBe("backend_bot-2");
  });

  it("rejects ambiguous handles", () => {
    for (const value of ["-alice", "alice-", "alice smith", "", "a".repeat(65)]) {
      expect(() => normalizeUsername(value)).toThrow("username");
    }
  });
});
