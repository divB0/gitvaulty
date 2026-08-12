import { describe, expect, it } from "vitest";

import { sourceToVirtualParts, sourceUriFromVirtual } from "../src/uri.js";

describe("GitVaulty virtual URIs", () => {
  it("maps a ciphertext URI to a plaintext-shaped virtual URI and back", () => {
    const source = {
      scheme: "file",
      path: "/repo/config/secrets.yaml.gitvaulty",
      value: "file:///repo/config/secrets.yaml.gitvaulty",
    };

    const virtual = sourceToVirtualParts(source);

    expect(virtual).toEqual({
      scheme: "gitvaulty",
      authority: "document",
      path: "/repo/config/secrets.yaml",
      query: "source=file%3A%2F%2F%2Frepo%2Fconfig%2Fsecrets.yaml.gitvaulty",
    });
    expect(sourceUriFromVirtual(virtual)).toBe(source.value);
  });

  it("keeps multi-root files distinct even when their logical names match", () => {
    const first = sourceToVirtualParts({ scheme: "file", path: "/one/.env.gitvaulty", value: "file:///one/.env.gitvaulty" });
    const second = sourceToVirtualParts({ scheme: "file", path: "/two/.env.gitvaulty", value: "file:///two/.env.gitvaulty" });

    expect(first.path).toBe("/one/.env");
    expect(second.path).toBe("/two/.env");
    expect(first.query).not.toBe(second.query);
  });

  it("rejects unsupported schemes and non-GitVaulty source files", () => {
    expect(() => sourceToVirtualParts({ scheme: "untitled", path: "/.env.gitvaulty", value: "untitled:/.env.gitvaulty" })).toThrow("Unsupported");
    expect(() => sourceToVirtualParts({ scheme: "file", path: "/repo/.env", value: "file:///repo/.env" })).toThrow("must end");
    expect(() => sourceUriFromVirtual({ scheme: "file", authority: "document", path: "/repo/.env", query: "" })).toThrow("Invalid");
  });
});
