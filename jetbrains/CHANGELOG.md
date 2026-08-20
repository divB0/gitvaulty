# Changelog

## 3.0.0

- Align the plugin and native runtime versions with the GitVaulty core version they bundle.
- Move Stable-channel publication to the shared GitVaulty `vX.Y.Z` release tag.
- Include GitVaulty 3.0.0 identity and signed-policy behavior in the native editor integration.

## 0.1.1

- Refresh the signed native runtime and verify automated Marketplace updates.

## 0.1.0

- Open authorized `*.gitvaulty` files in the native JetBrains text editor.
- Re-encrypt, verify, and atomically replace ciphertext on save.
- Detect external ciphertext changes and refuse stale writes.
- Show access and paths, reload from ciphertext, and explicitly export a private decrypted copy.
- Download a platform-native GitVaulty runtime only after exact size and SHA-256 verification.
