# Changelog

## 3.0.0

- Make `GITVAULTY_AGE_KEY_FILE` the only supported master-identity file override.
- Ignore `SOPS_AGE_KEY_FILE` during GitVaulty identity resolution.
- Continue scrubbing `SOPS_AGE_KEY_FILE` before invoking SOPS or wrapped commands so child
  processes cannot load an unintended private key.
- Preserve existing identity bytes, recipients, signing keys, repository policies, and ciphertext;
  upgrading from 2.x only requires renaming the environment variable.
