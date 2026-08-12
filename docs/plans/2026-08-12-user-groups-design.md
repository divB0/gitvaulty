# User Groups Design

## Goal

Make groups the default way to share GitVaulty files while retaining direct per-user grants for exceptional cases. A repository starts with a `team` group containing its owner, and new files are assigned to that group unless the creator chooses another policy.

## Registry model

The registry moves to version 3 and separates identity, membership, and file policy:

```json
{
  "version": 3,
  "defaultGroup": "team",
  "users": [
    { "username": "alice", "recipient": "age1..." }
  ],
  "groups": [
    { "name": "team", "members": ["alice"] }
  ],
  "files": [
    { "path": ".env.gitvaulty", "groups": ["team"], "users": [] }
  ]
}
```

Effective recipients are the union of direct users and members of every group assigned to a file. Names, memberships, file paths, and grants are normalized, deduplicated, and sorted before persistence. All references must resolve to known users or groups, every file must have at least one effective recipient, and the default group must exist. Registry v2 is deliberately unsupported because this repository does not require backward compatibility.

`.sops.yaml` remains generated data. It contains one exact path rule per registered encrypted file and the resolved age recipients for that file.

## User experience

`gitvaulty init` creates `team`, adds the owner, and makes it the default. `create` and `import` accept repeatable `--group` and `--user` options; when neither is supplied, access defaults to `team`. This preserves the simplest workflow while allowing a file to start with a narrower audience.

`gitvaulty user add` asks for a public recipient and username, then presents groups rather than individual files. `user list` shows group membership. Direct grants are managed at the file boundary rather than during onboarding.

Groups are managed with:

- `gitvaulty group create <name>`
- `gitvaulty group add <group> <username>`
- `gitvaulty group remove <group> <username>`
- `gitvaulty group list`
- `gitvaulty group delete <name>`

`gitvaulty access <path>` provides the editing UX for an existing file: interactively select groups and optional direct users, or pass repeatable `--group` and `--user` options to set the policy non-interactively. It displays the effective users after applying the policy. A group cannot be deleted while any file uses it, and the default group cannot be deleted.

## Security and transactions

Adding or removing group membership, changing a file policy, and removing a user can change effective recipients across several files. GitVaulty computes the before and after recipient sets and touches only changed files. It decrypts affected ciphertext before writing the new registry, re-encrypts each plaintext with the exact new recipients, verifies decryption, and atomically replaces the ciphertext.

Before mutation, the registry and every affected ciphertext are snapshotted. If any write, encryption, or verification fails, GitVaulty restores all ciphertext and the original registry. Mutations that would leave a file with no recipients are rejected before anything is written. Removing a user also removes their group memberships and direct grants. Content remains opaque whole-file SOPS binary data.

## Testing

Registry tests cover normalization, referential integrity, exact recipient resolution, deterministic SOPS rules, invalid group names, and rejection of v2 data. Operation tests cover default `team` creation and grants, explicit group/direct policies, authorization via groups, group CRUD, used-group deletion refusal, user onboarding, membership changes, access changes, last-recipient protection, user removal, re-encryption, and rollback. CLI tests cover the new command surface and human-readable group/user formatting. The final gate is the repository's full `npm run check` command.
