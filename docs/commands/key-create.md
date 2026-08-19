# `gitvaulty key create`

Generate and store a new global native age identity.

## Usage

```sh
npx gitvaulty key create
```

GitVaulty generates an age private identity, derives its public recipient, and writes the private identity to the configured identity file with mode `0600`. The output prints the file location, public `age1...` recipient, and a reminder to back it up.

The command uses `GITVAULTY_AGE_KEY_FILE` or `SOPS_AGE_KEY_FILE` when configured; otherwise it uses the platform default described in [`gitvaulty key`](key.md#identity-sources).

## Existing identities

`key create` uses exclusive file creation and refuses to overwrite an existing identity file. Use [`gitvaulty key restore`](key-restore.md) if you intentionally need to replace the stored identity.

This command does not initialize a repository or add the public recipient to an existing repository.
Any repository command initializes a new repository automatically; use [`gitvaulty init`](init.md)
to prepare it explicitly, or run
[`gitvaulty user register <username>`](user-register.md) to commit the public recipient to an
existing repository without granting access.

## Related commands

- [`gitvaulty key backup`](key-backup.md)
- [`gitvaulty key public`](key-public.md)
- [`gitvaulty user register`](user-register.md)
