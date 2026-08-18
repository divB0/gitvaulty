import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { createRuntimeManifest } from "./package-tools.mjs";

/** @param {string} name */
function option(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`Missing ${name}.`);
  return process.argv[index + 1];
}

const assets = path.resolve(option("--assets"));
const output = path.resolve(option("--output"));
const tag = option("--tag");
const repository = option("--repository");
const manifest = await createRuntimeManifest(assets, tag, repository);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
