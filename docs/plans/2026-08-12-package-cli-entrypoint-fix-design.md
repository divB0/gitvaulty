# Packaged CLI entrypoint fix design

## Problem

The npm package installs `dist/cli.js` behind `node_modules/.bin/gitvaulty`. The bundled module starts only when `import.meta.url` exactly equals a string assembled from `process.argv[1]`. Node resolves the module to its real path, while `process.argv[1]` can retain the npm bin symlink or a symlinked parent such as macOS `/tmp`. The comparison fails silently, so the process exits successfully without parsing the command. The CLI version is also hardcoded independently from `package.json`, allowing published metadata and `gitvaulty --version` to diverge.

## Design

Introduce a small exported entrypoint predicate that converts the module URL to a filesystem path and compares canonical real paths. Missing or inaccessible argv paths return false, preserving safe behavior when the module is imported. The bottom-level guard uses this predicate before calling `main()`.

Read the package version from the repository/package root at module initialization and pass it to Commander. Both source tests and the bundled npm layout keep `package.json` one directory above `src/` or `dist/`, so one URL-relative read works in both contexts without build-time code generation.

Regression tests create a temporary real file and symlink, proving both direct and symlink argv paths are recognized while a different file is rejected. Another assertion compares `createProgram().version()` to `package.json`. The release smoke check will install the published package in a fresh directory, assert the installed and CLI versions match, and exercise isolated key creation and reading.

Because `0.1.1` is immutable and contains the broken npm entrypoint, the correction ships as `0.1.2`.
