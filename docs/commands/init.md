# `gitvaulty init`

Explicitly prepare GitVaulty in the current Git repository. Running this command is optional because
every repository-scoped command performs the same preparation before its requested operation.

## Usage

```sh
npx gitvaulty init
```

## What it does

1. Finds the root of the current Git repository.
2. Loads your global master identity. If none exists interactively, GitVaulty offers to restore a
   backup through masked input, create a new key, or cancel.
3. If the recipient registry is missing, prompts for your GitVaulty username. The default is derived
   from `git config user.email`, then `git config user.name`.
4. Creates you as the first user and as the first manager and member of the default `team` group.
5. Writes `.gitvaulty/config.yaml`, the recipient registry, and the SOPS configuration. When the
   registry already exists, it is validated and preserved while missing config or SOPS files are
   recreated.
6. Installs or updates the repository-scoped agent skill at
   `.agents/skills/gitvaulty/SKILL.md` when skill management is enabled.
7. Reports that GitVaulty is ready. Repeated invocations are safe and idempotent.

The initial registry is `.gitvaulty/recipients.json`:

```json
{
  "version": 4,
  "defaultGroup": "team",
  "users": [{ "username": "alice", "recipient": "age1...", "signingKey": "ed25519:..." }],
  "groups": [{ "name": "team", "policies": [{ "revision": 1, "previous": null, "managers": ["alice"], "members": [{ "username": "alice", "recipient": "age1...", "signingKey": "ed25519:..." }], "signedBy": "alice", "signature": "ed25519:..." }] }],
  "files": []
}
```

GitVaulty also writes `.sops.yaml`. It has no creation rules until a file is created or imported.

The initial repository preferences are `.gitvaulty/config.yaml`:

```yaml
version: 1
agentSkill:
  mode: managed
```

## Agent skill

The installed skill teaches compatible coding agents to expose only the secret files required for a
task through `gitvaulty run -f <path> -- <command>`. It tells agents not to print secrets, interpolate
them into command lines, include them in prompts, or commit plaintext files.

GitVaulty compares the repository skill with the version bundled in the installed package using a
SHA-256 digest of text with normalized line endings. In `managed` mode, a missing skill is installed
and a differing skill is replaced automatically, including during non-interactive and CI commands.
Set `agentSkill.mode` to `disabled` before maintaining custom instructions; GitVaulty then leaves
missing, old, and custom skill files untouched.

The skill is operating guidance, not a security boundary. An agent with unrestricted shell access
can still read plaintext while it is materialized. Enforce hard isolation and prompt blocking in the
agent harness or sandbox.

## Identity storage

Only the public age recipient and signing key are stored in the repository. The master identity is stored outside the repository, normally at `~/.config/gitvaulty/identity`, with mode `0600`. Derived private keys exist only in process memory.

## Important behavior

- The command must run inside a Git repository.
- It checks the global identity on every invocation, including when the repository is already ready.
- It never replaces an existing recipient registry during repair.
- It does not create, import, encrypt, stage, or commit any secret files.
- It does not run `git add` or modify `.gitignore`.
- It automatically replaces a differing agent skill while `agentSkill.mode` is `managed`.
- Repository commands run the same preparation before their own operation.
- An existing `.sops.yaml` is replaced during successful initialization, so review or preserve a pre-existing SOPS configuration first.

## Next steps

- Use [`gitvaulty create`](create.md) for a new secret file.
- Use [`gitvaulty import`](import.md) for an existing plaintext file.
- Back up a newly created identity with [`gitvaulty key backup`](key-backup.md).
