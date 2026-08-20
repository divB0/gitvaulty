# Changelog

## 3.0.2 — Stable Marketplace listing

- Remove the Preview designation from the Visual Studio Marketplace listing.

## 3.0.0 — Unified versioning

- Align the extension version with the GitVaulty core version it bundles.
- Move stable extension publication to the shared GitVaulty `vX.Y.Z` release tag.
- Include GitVaulty 3.0.0 identity and signed-policy behavior in the native editor integration.

## 0.1.0 — Preview

- Open `*.gitvaulty` files automatically as native decrypted virtual documents.
- Preserve plaintext filenames for syntax highlighting and compatible language features.
- Re-encrypt, verify, and atomically replace ciphertext on Save and Auto Save.
- Detect external ciphertext changes and refuse conflicting saves.
- Show effective file access and expose encrypted-path and reload commands.
- Support macOS arm64/x64, Linux arm64/x64, and Windows x64 packages.
