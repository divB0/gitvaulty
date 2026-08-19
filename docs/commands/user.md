# `gitvaulty user`

Manage the users whose public age recipients are registered in the repository.

## Usage

```sh
npx gitvaulty user <command>
```

## Commands

| Command | Purpose |
| --- | --- |
| [`user register`](user-register.md) | Register your own public identity without receiving access. |
| [`user add`](user-add.md) | Register both public keys and add the user to managed groups. |
| [`user list`](user-list.md) | List registered users and their group memberships. |
| [`user remove`](user-remove.md) | Remove a user and re-encrypt files whose recipient set changes. |

Users are repository-scoped entries in `.gitvaulty/recipients.json`. Each user has a normalized username and a unique public age recipient. Usernames use lowercase letters, numbers, `.`, `_`, or `-` and are at most 64 characters.

File access is normally granted through [`gitvaulty group`](group.md). Direct user grants are supported as exceptions through [`gitvaulty access`](access.md).

Changes to users can update the registry, `.sops.yaml`, and affected ciphertext. GitVaulty does not stage or commit those changes.

For normal onboarding, the new developer runs `user register` and commits both public keys.
A current group manager then reviews them and runs [`group add`](group-add.md) to approve
access. `user add` is an interactive shortcut for an authorized developer who already has the new
user's public identity.
