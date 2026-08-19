# `gitvaulty group list`

List access groups, managers, and members.

## Usage

```sh
npx gitvaulty group list
```

Example output:

```text
GROUP           MANAGERS  MEMBERS
platform        alice     alice, carol
production      alice     alice
team (default)  alice     alice, bob, carol
```

The default group is labeled `(default)`. Managers and members are sorted. Every manager also appears in the member column.

The command runs the standard repository preparation first, including the global identity check,
implicit initialization or metadata repair, and managed agent-skill synchronization. It then reads
and verifies every signed policy revision in `.gitvaulty/recipients.json` without decrypting files
or showing which files use each group. In an already current repository, the listing itself does not
modify access policy.

## Related commands

- [`gitvaulty user list`](user-list.md)
- [`gitvaulty group add`](group-add.md)
- [`gitvaulty group remove`](group-remove.md)
- [`gitvaulty group manager`](group-manager.md)
- [`gitvaulty group delete`](group-delete.md)
