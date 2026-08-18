import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export const RUNTIME_VERSION = "0.1.0";
export const PROTOCOL_VERSION = 1;
export const SUPPORTED_TARGETS = ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64", "win32-x64"];

/** @param {string} platform @param {string} architecture */
export function runtimeTarget(platform, architecture) {
  const target = `${platform}-${architecture}`;
  if (!SUPPORTED_TARGETS.includes(target)) throw new Error(`Unsupported runtime platform: ${target}.`);
  return target;
}

/** @param {string} target */
export function runtimeFilename(target) {
  if (!SUPPORTED_TARGETS.includes(target)) throw new Error(`Unsupported runtime target: ${target}.`);
  return `gitvaulty-editor-runtime-v${RUNTIME_VERSION}-${target}.zip`;
}

/**
 * @param {string} assetsDirectory
 * @param {string} tag
 * @param {string} repositoryUrl
 */
export async function createRuntimeManifest(assetsDirectory, tag, repositoryUrl) {
  if (!/^jetbrains-v\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(tag)) throw new Error("Invalid JetBrains release tag.");
  const base = repositoryUrl.replace(/\/$/, "");
  const assets = [];
  for (const target of SUPPORTED_TARGETS) {
    const filename = runtimeFilename(target);
    const file = path.join(assetsDirectory, filename);
    const bytes = await readFile(file);
    const details = await stat(file);
    assets.push({
      target,
      filename,
      url: `${base}/releases/download/${tag}/${filename}`,
      size: details.size,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  return { protocolVersion: PROTOCOL_VERSION, runtimeVersion: RUNTIME_VERSION, assets };
}
