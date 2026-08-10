import { describe, expect, it } from "vitest";

import { normalizeUsername, parseRecipient } from "../src/recipient.js";

const ageRecipient = "age1nx73yf2gmghjapkvxzkx26z72uakmnppchya8d4xfjd67hhglqdq7swsm0";

describe("recipient parsing", () => {
  it("accepts validated native age recipients", () => {
    expect(parseRecipient(ageRecipient)).toBe(ageRecipient);
    expect(() => parseRecipient(`${ageRecipient.slice(0, -1)}q`)).toThrow("valid public age recipient");
  });

  it("rejects private and SSH keys", () => {
    expect(() => parseRecipient("AGE-SECRET-KEY-1EXAMPLE")).toThrow("public age recipient");
    expect(() => parseRecipient("ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")).toThrow("public age recipient");
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
