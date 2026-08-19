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

The command reads and verifies every signed policy revision in `.gitvaulty/recipients.json`. It does not require your private identity, decrypt files, show which files use each group, or modify repository state.

## Related commands

- [`gitvaulty user list`](user-list.md)
- [`gitvaulty group add`](group-add.md)
- [`gitvaulty group remove`](group-remove.md)
- [`gitvaulty group manager`](group-manager.md)
- [`gitvaulty group delete`](group-delete.md)
