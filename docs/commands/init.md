# `gitvaulty init`

Initialize GitVaulty in the current Git repository.

## Usage

```sh
npx gitvaulty init
```

## What it does

1. Finds the root of the current Git repository.
2. Stops immediately without prompting if `.gitvaulty/recipients.json` already exists.
3. Loads your global age identity. If no identity exists, GitVaulty asks whether to create one.
4. Prompts for your GitVaulty username. The default is derived from `git config user.email`, then `git config user.name`.
5. Creates you as the first user and creates a default `team` group containing you.
6. Writes an empty recipient registry and SOPS configuration.
7. Installs a repository-scoped agent skill at `.agents/skills/gitvaulty/SKILL.md`.

The initial registry is `.gitvaulty/recipients.json`:

```json
{
  "version": 3,
  "defaultGroup": "team",
  "users": [{ "username": "alice", "recipient": "age1..." }],
  "groups": [{ "name": "team", "members": ["alice"] }],
  "files": []
}
```

GitVaulty also writes `.sops.yaml`. It has no creation rules until a file is created or imported.

## Agent skill

The installed skill teaches compatible coding agents to expose only the secret files required for a
task through `gitvaulty run -f <path> -- <command>`. It tells agents not to print secrets, interpolate
them into command lines, include them in prompts, or commit plaintext files.

If `.agents/skills/gitvaulty/SKILL.md` already exists, initialization preserves its exact contents
instead of overwriting custom instructions. GitVaulty reports whether it installed or preserved the
skill.

The skill is operating guidance, not a security boundary. An agent with unrestricted shell access
can still read plaintext while it is materialized. Enforce hard isolation and prompt blocking in the
agent harness or sandbox.

## Identity storage

Only your public age recipient is stored in the repository. A newly generated private identity is stored outside the repository, normally at `~/.config/gitvaulty/identity.txt`, with mode `0600`. Environment-based identities are used without creating that file.

## Important behavior

- The command must run inside a Git repository.
- It stops before any identity or username prompts if `.gitvaulty/recipients.json` already exists.
- It does not create, import, encrypt, stage, or commit any secret files.
- It does not run `git add` or modify `.gitignore`.
- It creates the agent skill only when that exact file does not already exist.
- An existing `.sops.yaml` is replaced during successful initialization, so review or preserve a pre-existing SOPS configuration first.

## Next steps

- Use [`gitvaulty create`](create.md) for a new secret file.
- Use [`gitvaulty import`](import.md) for an existing plaintext file.
- Back up a newly created identity with [`gitvaulty key backup`](key-backup.md).
