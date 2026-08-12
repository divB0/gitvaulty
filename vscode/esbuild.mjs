import { build } from "esbuild";

await build({
  entryPoints: ["src/extension.ts"],
  outfile: "dist/extension.js",
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  external: ["vscode"],
  sourcemap: false,
  minify: true,
});
