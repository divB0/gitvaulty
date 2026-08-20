import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function replaceExactlyOnce(contents, pattern, replacement, file) {
  const matches = contents.match(new RegExp(pattern.source, `${pattern.flags.replace("g", "")}g`)) ?? [];
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one version field in ${file}, found ${matches.length}.`);
  }
  return contents.replace(pattern, replacement);
}

async function synchronizedJson(relative, version) {
  const file = path.join(repositoryRoot, relative);
  const parsed = JSON.parse(await readFile(file, "utf8"));
  parsed.version = version;
  if (relative.endsWith("package-lock.json")) parsed.packages[""].version = version;
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

async function desiredFiles(version) {
  const files = new Map();
  for (const relative of [
    "vscode/package.json",
    "vscode/package-lock.json",
    "editor-runtime/package.json",
    "editor-runtime/package-lock.json",
  ]) {
    files.set(relative, await synchronizedJson(relative, version));
  }

  const replacements = [
    ["jetbrains/build.gradle.kts", /^version = "[^"]+"$/m, `version = "${version}"`],
    [
      "editor-runtime/scripts/package-tools.mjs",
      /^export const RUNTIME_VERSION = "[^"]+";$/m,
      `export const RUNTIME_VERSION = "${version}";`,
    ],
    [
      "editor-runtime/src/bridge.ts",
      /runtimeVersion: "[^"]+"/,
      `runtimeVersion: "${version}"`,
    ],
  ];
  for (const [relative, pattern, replacement] of replacements) {
    const current = await readFile(path.join(repositoryRoot, relative), "utf8");
    files.set(relative, replaceExactlyOnce(current, pattern, replacement, relative));
  }

  const manifestRelative = "jetbrains/src/main/resources/gitvaulty-runtime-manifest.json";
  const manifest = JSON.parse(await readFile(path.join(repositoryRoot, manifestRelative), "utf8"));
  manifest.runtimeVersion = version;
  files.set(manifestRelative, `${JSON.stringify(manifest, null, 2)}\n`);
  return files;
}

export async function syncEditorVersions({ check = false } = {}) {
  const rootPackage = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8"));
  const version = rootPackage.version;
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Root package version must use X.Y.Z semantic versioning: ${String(version)}.`);
  }

  const changed = [];
  for (const [relative, desired] of await desiredFiles(version)) {
    const file = path.join(repositoryRoot, relative);
    if (await readFile(file, "utf8") === desired) continue;
    changed.push(relative);
    if (!check) await writeFile(file, desired);
  }

  if (check && changed.length > 0) {
    throw new Error(`Editor versions differ from package.json (${version}): ${changed.join(", ")}. Run npm run versions:sync.`);
  }
  return { version, changed };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await syncEditorVersions({ check: process.argv.includes("--check") });
  if (!process.argv.includes("--check") && result.changed.length > 0) {
    process.stdout.write(`Synchronized editor versions to ${result.version}: ${result.changed.join(", ")}\n`);
  }
}
