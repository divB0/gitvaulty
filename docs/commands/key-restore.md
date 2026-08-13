# `gitvaulty key restore`

Restore a native age private identity from a backup.

## Usage

```sh
npx gitvaulty key restore
```

If a stored or environment-provided identity is already available, GitVaulty asks whether to replace the existing global identity. The default is no. It then prompts for the `AGE-SECRET-KEY-...` backup with masked input.

GitVaulty validates that the input contains exactly one native age private key, derives its public recipient, and writes it to the configured identity file with mode `0600`. The command reports the restored public recipient.

## Replacement consequences

Replacing your private identity does not update any repository registry. If the restored key has a different public recipient, repositories that still list the previous recipient will no longer recognize or authorize the new identity. An existing repository member must add the new recipient with [`gitvaulty user add`](user-add.md), and the old user can then be removed when appropriate.

When an identity comes from an environment variable, the replacement confirmation still appears, but the restored key is written to the configured identity file; it does not rewrite the environment variable.

This command does not require an initialized repository.

## Related commands

- [`gitvaulty key backup`](key-backup.md)
- [`gitvaulty key public`](key-public.md)
- [`gitvaulty user add`](user-add.md)
