# Changelog

## 3.0.2

- Publish the VS Code extension as stable by removing its Marketplace Preview designation.

## 3.0.1

- Add stable GitVaulty support for compatible JetBrains IDEs through JetBrains Marketplace.
- Publish the CLI, native editor runtimes, VS Code extension, and JetBrains plugin from one shared
  `vX.Y.Z` release tag.
- Automate signed JetBrains plugin publication and attach verified editor runtimes to each GitHub
  release.

## 3.0.0

- Make `GITVAULTY_AGE_KEY_FILE` the only supported master-identity file override.
- Ignore `SOPS_AGE_KEY_FILE` during GitVaulty identity resolution.
- Continue scrubbing `SOPS_AGE_KEY_FILE` before invoking SOPS or wrapped commands so child
  processes cannot load an unintended private key.
- Preserve existing identity bytes, recipients, signing keys, repository policies, and ciphertext;
  upgrading from 2.x only requires renaming the environment variable.
