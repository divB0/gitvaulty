import { build } from "esbuild";

await Promise.all([
  build({
    entryPoints: ["src/test/runTest.ts"],
    outfile: "dist/test/runTest.cjs",
    bundle: true,
    format: "cjs",
    platform: "node",
    target: "node20",
    external: ["@vscode/test-electron"],
    sourcemap: false,
  }),
  build({
    entryPoints: ["src/test/suite/index.ts"],
    outfile: "dist/test/suite/index.cjs",
    bundle: true,
    format: "cjs",
    platform: "node",
    target: "node20",
    external: ["vscode"],
    sourcemap: false,
  }),
  build({
    entryPoints: ["src/test/suite/editor-host.ts"],
    outfile: "dist/test/suite/editor-host.mjs",
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node20",
    external: ["vscode"],
    banner: { js: 'import { createRequire as __gitvaultyCreateRequire } from "node:module"; const require = __gitvaultyCreateRequire(import.meta.url);' },
    sourcemap: false,
  }),
]);
