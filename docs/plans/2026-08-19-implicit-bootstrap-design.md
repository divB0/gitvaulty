# Implicit repository bootstrap design

## Goal

Make `gitvaulty init` optional by preparing GitVaulty automatically before every repository-scoped
command. Keep `init` as an explicit, idempotent way to run the same preparation. This intentionally
changes command side effects and ships as the approved `1.0.0` breaking release.

## Shared bootstrap

The CLI will have one shared repository bootstrap routine. Both `gitvaulty init` and every
repository-scoped command call it; global `gitvaulty key` commands do not.

The routine performs these steps in order:

1. Find the current Git repository. If there is none, stop before prompting or writing files.
2. Resolve the global age identity. If it is missing interactively, offer to restore an existing
   backup with masked input, create a new identity, or cancel.
3. If `.gitvaulty/recipients.json` is missing, obtain a normalized username and initialize the
   owner, default `team` group, repository configuration, and SOPS configuration without a
   permission prompt.
4. If the registry exists, preserve it. Repair only missing derived metadata such as
   `.gitvaulty/config.yaml` or `.sops.yaml`; invalid existing metadata is an error rather than a
   reason to reset access policy.
5. Synchronize the repository agent skill according to repository configuration.
6. Return the prepared repository and continue the originally requested command.

Interactive initialization prompts for a username with the value derived from `git config
user.email`, then `git config user.name`, as its default. A non-interactive invocation may use a
valid derived username; otherwise it fails with instructions to initialize interactively. If
bootstrap succeeds and the requested command subsequently fails, the initialized metadata remains.

Commands with strict stdout contracts keep stdout clean. Diagnostics and bootstrap notifications go
to stderr. A command that cannot safely prompt, including a piped `cat`, fails clearly when required
identity or username input is unavailable.

## Identity flow

The existing identity primitives remain deterministic and non-interactive. CLI orchestration owns
the prompt:

- **Restore existing backup** asks for the private `AGE-SECRET-KEY-...` value through the existing
  masked password prompt and never echoes it.
- **Create new key** uses the existing secure identity creation and prints only its path, public
  recipient, and backup reminder.
- **Cancel** exits without repository initialization.

All repository commands use the same identity check instead of repeating it in individual action
handlers. Explicit key management remains usable outside a Git repository.

## Agent skill management

The existing skill implementation remains the source of truth:

- `agentSkillStatus` compares normalized SHA-256 digests and reports `missing`, `current`, or
  `different`.
- `installAgentSkill` performs symlink-safe, concurrency-checked atomic installation or replacement.
- `.gitvaulty/config.yaml` selects `agentSkill.mode: managed` or `disabled`.

The policy changes so `managed` means fully managed. A missing skill is installed and a differing
skill is replaced automatically, including in non-interactive and CI invocations. A current skill is
untouched. `disabled` suppresses inspection and mutation, allowing repositories to maintain custom
instructions. Installation and update notices go to stderr so command output remains composable.

Skill synchronization is the final stage of the same shared bootstrap used by explicit and implicit
initialization; it is not a parallel initialization path.

## Failure and repair behavior

- Outside Git: report that the current directory is not inside a Git repository and exit without
  other work.
- Missing identity in an interactive session: show the restore/create/cancel choice.
- Missing identity or username in a non-interactive session: fail without partial identity input or
  secret output.
- Missing registry: create a fresh version 3 registry and related metadata.
- Existing registry with missing repository config or SOPS config: regenerate only the missing
  metadata from the existing registry.
- Invalid registry or config: fail without overwriting it.
- Skill path containing symlinks or non-regular files: retain the existing safety error.
- Concurrent skill modification: retain the existing update refusal.

`gitvaulty init` becomes idempotent. It runs the shared bootstrap and reports readiness whether it
created, repaired, updated, or found current state.

## Testing and release work

Focused CLI tests will cover bootstrap ordering, explicit and implicit initialization, continuation
into the requested command, idempotence, create/restore/cancel identity choices, masked restoration,
Git-derived usernames, and non-interactive failures. Repository tests will cover conservative config
and SOPS repair without recipient or group loss. Agent skill tests will cover automatic managed
installation and replacement, non-interactive synchronization, disabled mode, atomic safety, and
stderr-only notices. Output-sensitive tests will protect `cat`, `key public`, list commands, and
other machine-readable stdout.

The package version will move from `0.4.0` to `1.0.0`. Because this is a major release, the CLI,
prompts, output, access-control behavior, and demo scenario will be compared with
`docs/demo/instructions.md`. Any affected tape, driver, instructions, and generated GIF will be
updated and visually reviewed. Final validation will run the focused tests, full test suite,
typecheck, build, package smoke test, and demo generation when the scenario changes.
