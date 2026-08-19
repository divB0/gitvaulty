# `gitvaulty key public`

Print the public age recipient derived from your private identity.

## Usage

```sh
npx gitvaulty key public
```

Output is a single `age1...` recipient suitable for sharing with a teammate:

```text
age1example...
```

The public recipient allows others to encrypt files for you. It cannot decrypt files and does not reveal the private identity.

When joining an existing GitVaulty repository, prefer
[`gitvaulty user register <username>`](user-register.md). It derives the same public recipient and
adds it to the repository with no access so an existing member can review and approve a group grant.

If no identity is available interactively, GitVaulty offers to restore an existing backup through
masked input, create a new key, or cancel. Identity environment variables and configured key files
are supported as described in [`gitvaulty key`](key.md#identity-sources).

This command does not require an initialized Git repository and does not modify repository files.

## Related commands

- [`gitvaulty user register`](user-register.md)
- [`gitvaulty user add`](user-add.md)
- [`gitvaulty key create`](key-create.md)
- [`gitvaulty key backup`](key-backup.md)
