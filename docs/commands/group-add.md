# `gitvaulty group add`

Add an existing registered user to an access group.

## Usage

```sh
npx gitvaulty group add <group> <username>
```

Example:

```sh
npx gitvaulty group add production alice
```

Both the group and user must already exist, and the user must not already be a member.

## What it changes

GitVaulty adds the username to the group's membership in `.gitvaulty/recipients.json`. Every file granted to that group gains the user's public recipient unless the same recipient already had access through another selected group or direct grant. Files whose effective recipient set changes are re-encrypted, and `.sops.yaml` is regenerated.

The current identity must be registered and able to decrypt affected files. If writing or re-encryption fails, GitVaulty restores the prior registry, SOPS configuration, and ciphertext.

The command does not stage or commit modified files.

## Related commands

- [`gitvaulty user register`](user-register.md)
- [`gitvaulty user add`](user-add.md)
- [`gitvaulty group remove`](group-remove.md)
- [`gitvaulty group list`](group-list.md)
