# `gitvaulty group`

Manage repository-scoped access groups.

## Usage

```sh
npx gitvaulty group <command>
```

## Commands

| Command | Purpose |
| --- | --- |
| [`group create`](group-create.md) | Create a group managed by its creator. |
| [`group add`](group-add.md) | Add a registered user through a signed manager revision. |
| [`group remove`](group-remove.md) | Remove a non-manager member and re-encrypt affected files. |
| [`group manager`](group-manager.md) | Promote or demote group managers. |
| [`group list`](group-list.md) | List groups, managers, and members. |
| [`group delete`](group-delete.md) | Delete a non-default group that no files use. |

Groups are the primary way to assign file access. A file refers to group names in `.gitvaulty/recipients.json`; its effective age recipients are resolved from the current members of those groups plus any direct user grants.

Every manager is also a member. Only a manager from the preceding signed policy revision can authorize the next membership or manager revision. Adding or removing members can therefore change access to several encrypted files at once. When the effective recipient set changes, GitVaulty re-encrypts those files and regenerates `.sops.yaml` transactionally.

The signed revision chain detects tampering after its accepted first revision. Keep `.gitvaulty/recipients.json` protected by branch review so an attacker cannot replace the complete history with another genesis policy.

Group names follow the same format as usernames: lowercase letters, numbers, `.`, `_`, or `-`, with a maximum length of 64 characters.
