# How to Version GitVaulty

GitVaulty follows semantic versioning: `MAJOR.MINOR.PATCH`.

## Protect User Space

Never break existing user space in a minor or patch release. User space includes every documented or observable part of the command-line interface, including:

- command and subcommand names;
- positional arguments, options, and accepted values;
- defaults and configuration behavior;
- command semantics and side effects;
- output formats that users or scripts may consume; and
- exit codes and error behavior.

Preserve these contracts unless the user explicitly approves a breaking change. Before implementing a breaking change:

1. Explain what will break and why the change is necessary.
2. Ask the user for explicit approval.
3. Plan a major version bump for the release containing the change.

Do not implement the breaking change until approval is received.

## Choose the Version Bump

### Major

Bump the major version for any approved user-space breaking change, such as:

- removing or renaming a command, argument, or option;
- changing an existing argument's meaning or accepted syntax;
- changing defaults or behavior in a way that can alter existing workflows;
- changing script-consumable output or exit behavior incompatibly; or
- requiring users to rewrite existing commands or automation.

A major bump does not replace the approval requirement. Both are mandatory.

### Minor

Bump the minor version for new backward-compatible functionality, including adding a new command, argument, or option. Existing commands and workflows must continue to behave as before.

### Patch

Bump the patch version for backward-compatible fixes. A fix may correct behavior that is clearly defective, but it must not silently redefine an established user-space contract. If a proposed fix would break existing commands or their semantics, treat it as a breaking change instead.

Documentation, tests, and internal refactors that do not change the shipped package do not require a package version bump on their own.

## Decision Order

When classifying a change, use this order:

1. Does it break any existing user-space contract? Ask for approval and bump major.
2. Does it add backward-compatible functionality? Bump minor.
3. Does it only fix existing behavior compatibly? Bump patch.
4. Does it only change documentation, tests, or internals without affecting the shipped package? No package bump is required.

When uncertain whether users may rely on a behavior, treat it as user space and ask before changing it.
