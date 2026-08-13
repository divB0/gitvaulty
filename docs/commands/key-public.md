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

If no identity is available, GitVaulty asks whether to create one. Declining stops the command. Identity environment variables and configured key files are supported as described in [`gitvaulty key`](key.md#identity-sources).

This command does not require an initialized Git repository and does not modify repository files.

## Related commands

- [`gitvaulty user add`](user-add.md)
- [`gitvaulty key create`](key-create.md)
- [`gitvaulty key backup`](key-backup.md)
