# `gitvaulty group create`

Create a new empty access group.

## Usage

```sh
npx gitvaulty group create <name>
```

Example:

```sh
npx gitvaulty group create production
```

Names are normalized to lowercase and may contain letters, numbers, `.`, `_`, or `-`. The name must be unique.

The command adds an empty group to `.gitvaulty/recipients.json` and regenerates `.sops.yaml`. Because no file uses the new group and it has no members, no ciphertext is re-encrypted.

Creating a group does not make it the default. New files continue to use the registry's existing default group, initially `team`. There is currently no CLI command to change `defaultGroup`.

The command requires a registered local age identity and does not stage or commit its changes.

## Next steps

- Add members with [`gitvaulty group add`](group-add.md).
- Assign the group with [`gitvaulty access`](access.md), [`gitvaulty create`](create.md), or [`gitvaulty import`](import.md).
