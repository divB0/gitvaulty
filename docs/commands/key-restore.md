# `gitvaulty key restore`

Restore a GitVaulty master identity from a backup.

## Usage

```sh
npx gitvaulty key restore
```

If a stored or environment-provided identity is already available, GitVaulty asks whether to replace the existing global identity. The default is no. It then prompts for the `GITVAULTY-IDENTITY-...` backup with masked input.

GitVaulty validates exactly one master identity, derives both public keys, and writes the master identity to the configured file with mode `0600`.

## Replacement consequences

Replacing your private identity does not update any repository registry. If either derived public key differs, repositories listing the previous identity will no longer recognize or authorize the new one. Register the new public identity and have the appropriate managers grant access before removing the old user.

When an identity comes from an environment variable, the replacement confirmation still appears, but the restored key is written to the configured identity file; it does not rewrite the environment variable.

This command does not require an initialized repository.

## Related commands

- [`gitvaulty key backup`](key-backup.md)
- [`gitvaulty key public`](key-public.md)
- [`gitvaulty user add`](user-add.md)
