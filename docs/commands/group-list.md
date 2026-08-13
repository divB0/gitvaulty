# `gitvaulty group list`

List access groups and their members.

## Usage

```sh
npx gitvaulty group list
```

Example output:

```text
GROUP           MEMBERS
platform        alice, carol
production      alice
team (default)  alice, bob, carol
```

The default group is labeled `(default)`. Groups and member lists are normalized and stored in sorted order. A dash is displayed for an empty group.

The command reads `.gitvaulty/recipients.json` in the current Git repository. It does not require your private age identity, decrypt files, show which files use each group, or modify repository state.

## Related commands

- [`gitvaulty user list`](user-list.md)
- [`gitvaulty group add`](group-add.md)
- [`gitvaulty group remove`](group-remove.md)
- [`gitvaulty group delete`](group-delete.md)
