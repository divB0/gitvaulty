# `gitvaulty key public`

Print both public keys derived from your private master identity.

## Usage

```sh
npx gitvaulty key public
```

The output is safe to share:

```text
Age recipient: age1example...
Signing key: ed25519:example...
```

The age recipient allows others to encrypt files for you. The Ed25519 key lets repositories verify policy signatures made while you were a manager. Neither public key can decrypt, sign, or reveal the master identity.

When joining an existing GitVaulty repository, prefer
[`gitvaulty user register <username>`](user-register.md). It derives the same public identity and
adds it to the repository with no access so a group manager can review and approve a group grant.

If no identity is available, GitVaulty asks whether to create one. Declining stops the command. Identity environment variables and configured key files are supported as described in [`gitvaulty key`](key.md#identity-sources).

This command does not require an initialized Git repository and does not modify repository files.

## Related commands

- [`gitvaulty user register`](user-register.md)
- [`gitvaulty user add`](user-add.md)
- [`gitvaulty key create`](key-create.md)
- [`gitvaulty key backup`](key-backup.md)
