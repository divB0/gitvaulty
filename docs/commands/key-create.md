# `gitvaulty key create`

Generate and store one global GitVaulty master identity.

## Usage

```sh
npx gitvaulty key create
```

GitVaulty generates a random master secret and writes it to the configured identity file with mode `0600`. It derives a native age/X25519 encryption identity and Ed25519 signing identity in memory. The output prints both public keys and a reminder to back up the single master identity.

The command uses `GITVAULTY_AGE_KEY_FILE` or `SOPS_AGE_KEY_FILE` when configured; otherwise it uses the platform default described in [`gitvaulty key`](key.md#identity-sources).

## Existing identities

`key create` uses exclusive file creation and refuses to overwrite an existing identity file. Use [`gitvaulty key restore`](key-restore.md) if you intentionally need to replace the stored identity.

This command does not initialize a repository or add either public key to an existing repository.
Any repository command initializes a new repository automatically; use [`gitvaulty init`](init.md)
to prepare it explicitly, or run
[`gitvaulty user register`](user-register.md) to commit the public identity to an
existing repository without granting access.

## Related commands

- [`gitvaulty key backup`](key-backup.md)
- [`gitvaulty key public`](key-public.md)
- [`gitvaulty user register`](user-register.md)
