# Canonical identity path

## Goal

Make the extensionless `identity` file the only default location for the global GitVaulty master
identity and release the change as GitVaulty 2.0.0.

## Decision

GitVaulty resolves the default identity to `~/.config/gitvaulty/identity` on Unix-like systems and
`%APPDATA%\gitvaulty\identity` on Windows. Explicit `GITVAULTY_AGE_KEY_FILE` and
`SOPS_AGE_KEY_FILE` overrides keep their current precedence and may point to any filename.

The CLI does not probe, read, rename, or fall back to `identity.txt`. Users upgrading from a version
that stored a valid master identity there must rename that file before running 2.0.0. GitVaulty must
document that migration prominently in the key documentation and release notes.

## Compatibility and security

Changing the default path is an observable configuration break, so the release is a major version
bump under `HOW_TO_VERSION.md`. The strict behavior was explicitly approved. It also prevents a stale
legacy age identity at `identity.txt` from shadowing a valid master identity at the canonical path.

The change does not alter key bytes, public recipients, signing keys, repository policies, or
ciphertext. Moving the same valid master identity to the canonical path therefore does not require
re-encrypting existing `*.gitvaulty` files. The release process must not read or print private
identity contents.

## Testing and release

Focused path-resolution tests cover Unix, XDG, and Windows defaults plus both explicit overrides.
The full typecheck, test, build, and package-smoke suite must pass. Because this is a major release,
the CLI demo contract in `docs/demo/instructions.md` must be compared with the changed behavior,
`npm run demo:generate` must run, and the regenerated GIF must be visually reviewed and committed if
it changes.

Publish a GitHub release with a concise user-facing summary and an explicit pre-upgrade rename
instruction. The release workflow publishes the matching npm package. Homebrew propagation must be
verified afterward.
