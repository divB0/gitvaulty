# `gitvaulty access`

Replace the groups and direct users allowed to decrypt an encrypted file.

## Usage

```sh
npx gitvaulty access <path>
npx gitvaulty access <path> --group <name>... --user <username>...
```

Examples:

```sh
npx gitvaulty access .env.production
npx gitvaulty access .env.production --group production
npx gitvaulty access service-account.json --group platform --user alice
```

Use the logical plaintext path, not `<path>.gitvaulty`.

## Interactive mode

With no access options, GitVaulty shows two checklists: groups with access and direct user exceptions. Existing selections are checked. The submitted selections replace the current policy.

## Non-interactive mode

| Option | Meaning |
| --- | --- |
| `-g, --group <name>` | Select a group. Repeatable. |
| `-u, --user <username>` | Select a direct user. Repeatable. |

Supplying either option skips the prompts. The options describe the complete replacement policy, not additions. For example, `--group production` removes all current direct-user grants and all other groups.

## What it changes

GitVaulty validates every group and user, updates `.gitvaulty/recipients.json` and `.sops.yaml`, and re-encrypts the file whenever its effective recipient set changes. Re-encryption preserves the plaintext bytes while changing who can decrypt future ciphertext.

The operation refuses to remove your own access. If any write or re-encryption fails, GitVaulty restores the previous registry, SOPS configuration, and ciphertext.

Access can still overlap: removing a direct grant does not revoke a user who remains authorized through a selected group.

## Security note

Removing access prevents the removed recipient from decrypting the new ciphertext. It cannot make someone forget plaintext or old ciphertext they already possessed. Rotate credentials at their external provider when revoking access to sensitive values.

## Git behavior

The modified registry, `.sops.yaml`, and ciphertext are not automatically staged or committed.

## Related commands

- [`gitvaulty user`](user.md)
- [`gitvaulty group`](group.md)
- [`gitvaulty user remove`](user-remove.md)
- [`gitvaulty group remove`](group-remove.md)
