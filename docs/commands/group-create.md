# `gitvaulty group create`

Create a new manager-controlled access group.

## Usage

```sh
npx gitvaulty group create <name>
```

Example:

```sh
npx gitvaulty group create production
```

Names are normalized to lowercase and may contain letters, numbers, `.`, `_`, or `-`. The name must be unique.

The command creates the first signed group policy in `.gitvaulty/recipients.json`. The current user becomes both the first manager and first member, so they can read secrets later assigned to the group and authorize subsequent policy revisions. Because no file uses the new group yet, no ciphertext is re-encrypted.

Creating a group does not make it the default. New files continue to use the registry's existing default group, initially `team`. There is currently no CLI command to change `defaultGroup`.

The command requires a registered local GitVaulty identity and does not stage or commit its changes.

## Next steps

- Add members with [`gitvaulty group add`](group-add.md).
- Assign the group with [`gitvaulty access`](access.md), [`gitvaulty create`](create.md), or [`gitvaulty import`](import.md).
