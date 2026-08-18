import { describe, expect, it } from "vitest";
import { formatSecretDiff } from "../src/diff.js";

describe("secret diff formatting", () => {
  it("formats a Git-style unified diff with plaintext values", () => {
    expect(formatSecretDiff(
      ".env",
      Buffer.from("TOKEN=old\nPORT=1\n"),
      Buffer.from("TOKEN=new\nPORT=1\n"),
    )).toBe([
      "diff --git a/.env b/.env",
      "--- a/.env",
      "+++ b/.env",
      "@@ -1,2 +1,2 @@",
      "-TOKEN=old",
      "+TOKEN=new",
      " PORT=1",
      "",
    ].join("\n"));
  });

  it("preserves missing-final-newline markers", () => {
    expect(formatSecretDiff("secret.txt", Buffer.from("old"), Buffer.from("new"))).toBe([
      "diff --git a/secret.txt b/secret.txt",
      "--- a/secret.txt",
      "+++ b/secret.txt",
      "@@ -1,1 +1,1 @@",
      "-old",
      "\\ No newline at end of file",
      "+new",
      "\\ No newline at end of file",
      "",
    ].join("\n"));
  });

  it("reports differing binary files without corrupting their bytes", () => {
    expect(formatSecretDiff("secret.bin", Buffer.from([0xff]), Buffer.from([0xfe]))).toBe(
      "diff --git a/secret.bin b/secret.bin\nBinary files a/secret.bin and b/secret.bin differ\n",
    );
  });

  it("returns no output for identical text or binary bytes", () => {
    expect(formatSecretDiff("secret.txt", Buffer.from("same\n"), Buffer.from("same\n"))).toBe("");
    expect(formatSecretDiff("secret.bin", Buffer.from([0xff]), Buffer.from([0xff]))).toBe("");
  });
});
