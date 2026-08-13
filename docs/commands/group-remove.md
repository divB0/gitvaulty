# `gitvaulty group remove`

Remove a registered user from an access group and update affected ciphertext.

## Usage

```sh
npx gitvaulty group remove <group> <username>
```

Example:

```sh
npx gitvaulty group remove production alice
```

The group and membership must already exist.

## What it changes

GitVaulty removes the username from the group's membership in `.gitvaulty/recipients.json`. For files assigned to that group, the user loses access only when no other selected group or direct user grant still authorizes them. Files whose effective age recipient set changes are re-encrypted, and `.sops.yaml` is regenerated.

The operation refuses to remove your own access from any affected file. If any registry write or re-encryption fails, GitVaulty restores the previous registry, SOPS configuration, and ciphertext.

## Revocation limits

Re-encryption prevents a removed recipient from decrypting the new ciphertext. It cannot revoke plaintext or old ciphertext already copied. Rotate credentials at their external provider when membership removal represents a real security revocation.

The command does not ask for confirmation and does not stage or commit changes. Review the arguments carefully before running it.

## Related commands

- [`gitvaulty access`](access.md)
- [`gitvaulty user remove`](user-remove.md)
- [`gitvaulty group add`](group-add.md)
