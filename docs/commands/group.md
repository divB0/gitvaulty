# `gitvaulty group`

Manage repository-scoped access groups.

## Usage

```sh
npx gitvaulty group <command>
```

## Commands

| Command | Purpose |
| --- | --- |
| [`group create`](group-create.md) | Create an empty group. |
| [`group add`](group-add.md) | Add a registered user to a group. |
| [`group remove`](group-remove.md) | Remove a member and re-encrypt affected files. |
| [`group list`](group-list.md) | List groups and their members. |
| [`group delete`](group-delete.md) | Delete a non-default group that no files use. |

Groups are the primary way to assign file access. A file refers to group names in `.gitvaulty/recipients.json`; its effective age recipients are resolved from the current members of those groups plus any direct user grants.

Adding or removing members can therefore change access to several encrypted files at once. When the effective recipient set changes, GitVaulty re-encrypts those files and regenerates `.sops.yaml`.

Group names follow the same format as usernames: lowercase letters, numbers, `.`, `_`, or `-`, with a maximum length of 64 characters.
