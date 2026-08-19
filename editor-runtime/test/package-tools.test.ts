import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createRuntimeManifest, runtimeTarget } from "../scripts/package-tools.mjs";
import { injectSeaBlob } from "../scripts/sea-tools.mjs";

describe("runtime packaging", () => {
  it("maps only supported native platforms", () => {
    expect(runtimeTarget("darwin", "arm64")).toBe("darwin-arm64");
    expect(runtimeTarget("linux", "x64")).toBe("linux-x64");
    expect(runtimeTarget("win32", "x64")).toBe("win32-x64");
    expect(() => runtimeTarget("win32", "arm64")).toThrow("Unsupported runtime platform");
  });

  it("injects the Windows SEA blob through the postject API", async () => {
    const calls: unknown[][] = [];
    const inject = async (...arguments_: unknown[]) => { calls.push(arguments_); };
    const blob = Buffer.from("sea");

    await injectSeaBlob(inject, "runtime.exe", blob, "win32");

    expect(calls).toEqual([[
      "runtime.exe",
      "NODE_SEA_BLOB",
      blob,
      { sentinelFuse: "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2" },
    ]]);
  });

  it("creates a deterministic exact release manifest", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-runtime-manifest-"));
    const targets = ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64", "win32-x64"];
    for (const target of targets) {
      await writeFile(path.join(directory, `gitvaulty-editor-runtime-v0.1.1-${target}.zip`), Buffer.from(target));
    }

    const manifest = await createRuntimeManifest(directory, "jetbrains-v0.1.1", "https://github.com/divB0/gitvaulty");
    expect(manifest).toMatchObject({ protocolVersion: 1, runtimeVersion: "0.1.1" });
    expect(manifest.assets.map((asset: { target: string }) => asset.target)).toEqual(targets);
    expect(manifest.assets[0]).toMatchObject({
      target: "darwin-arm64",
      filename: "gitvaulty-editor-runtime-v0.1.1-darwin-arm64.zip",
      size: Buffer.byteLength("darwin-arm64"),
      url: "https://github.com/divB0/gitvaulty/releases/download/jetbrains-v0.1.1/gitvaulty-editor-runtime-v0.1.1-darwin-arm64.zip",
    });
    expect(manifest.assets[0].sha256).toMatch(/^[a-f0-9]{64}$/);

    await writeFile(path.join(directory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    expect(JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"))).toEqual(manifest);
  });
});
