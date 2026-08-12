import { describe, expect, it } from "vitest";

import { decodeSecretText, encodeSecretText } from "../src/text.js";

describe("secret text encoding", () => {
  it("round trips valid UTF-8 exactly", () => {
    const text = "TOKEN=secrèt 🔐\n";
    expect(decodeSecretText(encodeSecretText(text))).toBe(text);
  });

  it("rejects invalid UTF-8 and NUL bytes", () => {
    expect(() => decodeSecretText(Uint8Array.from([0xc3, 0x28]))).toThrow("UTF-8");
    expect(() => decodeSecretText(Uint8Array.from([65, 0, 66]))).toThrow("NUL");
  });
});
