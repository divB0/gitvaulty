# `gitvaulty user list`

List every registered user and their group memberships.

## Usage

```sh
npx gitvaulty user list
```

Example output:

```text
USERNAME  GROUPS
alice     platform (manager), team (manager)
bob       team
carol     —
```

Users are sorted by username. Group names are sorted for each user, and manager roles are labeled. A dash means the user has no group membership; the user might still have direct access to individual files.

The command runs the standard repository preparation first, including the global identity check,
implicit initialization or metadata repair, and managed agent-skill synchronization. It then reads
and verifies `.gitvaulty/recipients.json` without decrypting files. In an already current repository,
the listing itself does not modify access policy.

The output intentionally does not include public recipients or per-file access. Use [`gitvaulty group list`](group-list.md) for the group-oriented view and [`gitvaulty access`](access.md) to inspect or change one file interactively.

## Related commands

- [`gitvaulty user register`](user-register.md)
- [`gitvaulty user add`](user-add.md)
- [`gitvaulty user remove`](user-remove.md)
- [`gitvaulty group list`](group-list.md)
