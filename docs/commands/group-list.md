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

The command runs the standard repository preparation first, including the global identity check,
implicit initialization or metadata repair, and managed agent-skill synchronization. It then reads
`.gitvaulty/recipients.json` without decrypting files or showing which files use each group. In an
already current repository, the listing itself does not modify access policy.

## Related commands

- [`gitvaulty user list`](user-list.md)
- [`gitvaulty group add`](group-add.md)
- [`gitvaulty group remove`](group-remove.md)
- [`gitvaulty group delete`](group-delete.md)
