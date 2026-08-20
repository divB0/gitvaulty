# GitVaulty for VS Code

Edit complete GitVaulty-encrypted files in VS Code's native text editor.

[View GitVaulty on GitHub](https://github.com/divB0/gitvaulty) for source code, documentation, and
issue tracking.

## Install

[Install GitVaulty from the Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=divB0.gitvaulty),
search for **GitVaulty** in VS Code's Extensions view, or run:

```sh
code --install-extension divb0.gitvaulty
```

Native packages are available for macOS (Apple Silicon and Intel), Linux (ARM64 and x64), and
Windows x64.

## What it does

Open any `*.gitvaulty` file from the Explorer. GitVaulty automatically decrypts it into a native
virtual document named after the plaintext file—for example, `.env.gitvaulty` opens as `.env`.
Normal syntax highlighting, themes, keyboard shortcuts, undo, formatting, and language features
that support virtual documents continue to work.

Save or Auto Save encrypts the updated bytes with the file's current GitVaulty access policy,
decrypts the result to verify an exact match, and atomically replaces the ciphertext. No plaintext
file is created in the repository.

## Requirements

- VS Code 1.100 or newer
- A Git repository initialized with GitVaulty
- Your GitVaulty age identity must have access to the file

The extension includes the appropriate SOPS executable for its published operating-system package.

## Commands

While a decrypted GitVaulty document is active:

- **GitVaulty: Show File Access** lists the users who can decrypt the file.
- **GitVaulty: Copy Encrypted File Path** copies the underlying `*.gitvaulty` path.
- **GitVaulty: Reload Encrypted Version** discards the editor buffer and reloads the ciphertext.

The `$(lock) GitVaulty` status item identifies decrypted virtual documents.

## Conflicts

The extension fingerprints the ciphertext when it opens. If Git, another editor, or another process
changes that ciphertext, GitVaulty does not silently overwrite it. A clean editor reloads. A dirty
editor offers to reload the encrypted version or save its decrypted contents to a location you
explicitly choose.

## Security boundary

GitVaulty does not write plaintext into the repository, a GitVaulty temporary directory, or the
extension's own storage. Native editing does place decrypted text in VS Code's document model.
Installed extensions and language servers may observe it, and VS Code may persist unsaved Hot Exit
or crash-recovery data in its private application storage. JavaScript cannot guarantee erasure of
copied strings or buffers.

For a more isolated workflow, continue using:

```sh
npx gitvaulty edit .env
```

The native editor currently accepts valid UTF-8 text without NUL bytes. Use the CLI workflow for
binary files.

## Development

Install the root dependencies first because the extension bundles GitVaulty's core TypeScript, then
install the extension package. Marketplace tooling requires Node.js 22 or newer.

```sh
npm ci
npm --prefix vscode ci
npm --prefix vscode run check
```

Create and test the package for the current machine:

```sh
npm --prefix vscode run package:local
```

The check runs unit tests, typechecking, the production bundle, and a real VS Code extension-host
test that opens, edits, saves, and verifies an encrypted fixture. Packaging stages only the current
platform's SOPS executable and its license into the VSIX.

## Marketplace releases

The extension uses the permanent Marketplace identity `divb0.gitvaulty`. Before a release:

1. Keep Azure managed identity `gitvaulty-vscode-publisher` registered as a Contributor to
   Marketplace publisher `divB0`, with its federated credential restricted to GitHub environment
   `vscode-marketplace` in repository `divB0/gitvaulty`.
2. Update `vscode/CHANGELOG.md` with extension-visible changes.
3. Follow the unified release process in [`HOW_TO_VERSION.md`](../HOW_TO_VERSION.md).

The **VS Code extension release** GitHub workflow builds and tests native packages for macOS arm64
and x64, Linux arm64 and x64, and Windows x64. The root `package.json` version is authoritative;
`npm version` synchronizes `vscode/package.json`, and the shared `vX.Y.Z` tag publishes the stable
extension together with the matching npm and JetBrains versions:

```sh
npm version patch
git push origin main --follow-tags
```

The workflow verifies that the tag, root package, and extension versions match before publishing all
five packages with `vsce --azure-credential`. GitHub OIDC signs into the managed identity using the
`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_SUBSCRIPTION_ID` repository variables; these are
public identifiers, not credentials. There is no Personal Access Token fallback or long-lived
publishing secret.

The manually dispatched **VS Code publisher identity** workflow resolves the managed identity's
non-secret Visual Studio profile ID for initial Marketplace Contributor registration or recovery. A
manual release run must name an existing `vX.Y.Z` tag and is only for retrying that exact release.
Marketplace version numbers cannot be reused.

For a local one-off inspection from the extension directory:

```sh
cd vscode
npm ci
npm run check:package
```

## License

MIT
