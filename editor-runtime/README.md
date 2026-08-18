# GitVaulty editor runtime

This private build package exposes GitVaulty's existing editor-safe core operations to native IDE
plugins over a bounded, length-prefixed standard-input/output protocol. It is not a separate public
API or cryptographic implementation.

`npm run bundle` builds the CommonJS payload used by Node single-executable applications. Run
`node scripts/build-runtime.mjs` on a supported native runner to build, inject, sign where needed,
smoke-test, and package that runner's runtime with the matching SOPS executable.

Release automation builds all five supported targets and calls `scripts/create-manifest.mjs` to
produce the exact size and SHA-256 manifest embedded in the JetBrains plugin.
