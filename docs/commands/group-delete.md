# `gitvaulty group delete`

Delete an access group that is no longer assigned to any encrypted file.

## Usage

```sh
npx gitvaulty group delete <name>
```

Example:

```sh
npx gitvaulty group delete staging
```

## Requirements

GitVaulty refuses to delete:

- the default group, initially `team`;
- a group that does not exist;
- a group still named in any file's access policy.

Remove the group from every affected file first with [`gitvaulty access`](access.md). The group may still contain members when deleted; membership alone does not block deletion.

## What it changes

The command removes the group from `.gitvaulty/recipients.json` and regenerates `.sops.yaml`. Because deletion is allowed only when no file uses the group, no ciphertext needs re-encryption.

The command requires a registered local age identity. It does not ask for confirmation and does not stage or commit changes.

## Related commands

- [`gitvaulty group list`](group-list.md)
- [`gitvaulty group create`](group-create.md)
- [`gitvaulty access`](access.md)
