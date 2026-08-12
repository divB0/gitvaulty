import { build } from "esbuild";

await build({
  entryPoints: ["src/extension.ts"],
  outfile: "dist/extension.js",
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  external: ["vscode"],
  banner: { js: 'import { createRequire as __gitvaultyCreateRequire } from "node:module"; const require = __gitvaultyCreateRequire(import.meta.url);' },
  sourcemap: false,
  minify: true,
});
