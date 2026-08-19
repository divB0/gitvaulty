# Interactive key backup destinations

## Goal

Make `gitvaulty key backup` guide people toward safer destinations without hiding unavailable
integrations. The bare command becomes interactive, while explicit `--clipboard` and `--print`
flags remain usable in non-interactive environments. This intentionally replaces the 1.0 behavior
that printed the identity after a confirmation, and the release is GitVaulty 1.1.0.

## User experience

With no destination flag, an interactive terminal asks where to save the backup:

```text
Where should GitVaulty save the backup?
> Password manager
  Clipboard
  Print to terminal
  Cancel
```

The password-manager screen always lists 1Password and Bitwarden. GitVaulty probes `op --version`
and `bw --version` without a shell and labels each entry `✓ Detected` or `○ CLI not found`.
An unavailable entry remains selectable. Selecting it shows provider-specific installation guidance
and offers **Check again** or **Back**. Installation is never automatic.

Detected but unauthenticated providers remain different from missing CLIs. 1Password performs its
normal CLI authentication when saving. Bitwarden uses `bw status`; an unauthenticated vault receives
login guidance, while a locked vault is unlocked interactively for this operation. A Bitwarden
session created by GitVaulty is invalidated after the save.

`--clipboard` and `--print` are mutually exclusive and bypass all destination prompts. `--print`
writes only the raw identity plus a trailing newline to stdout. `--clipboard` writes the identity to
the desktop clipboard and prints only a success message. A flagless invocation without an
interactive terminal fails and tells the user to choose one of these flags.

## Security and data flow

GitVaulty validates that a private identity exists before opening the destination flow, but it does
not pass that identity to a destination until the user has selected one. It never places the
identity in command arguments, the shell, a temporary file, status output, or provider output.
Provider processes are launched directly.

For 1Password, GitVaulty obtains the Password item template, fills its concealed password field in
memory, and supplies JSON to `op item create -` through stdin. For Bitwarden, GitVaulty builds a
Secure Note object in memory, base64-encodes it, and supplies it to `bw create item` through stdin.
The resulting provider JSON is captured and discarded because it may echo the stored value.

Bitwarden's unlock token is captured from `bw unlock --raw`, passed only in the child process
environment as `BW_SESSION`, and cleared from the local variable when the operation ends. If
GitVaulty created that session, it runs `bw lock` in a `finally` block. It does not lock sessions that
were already available to the user.

Clipboard writes are explicit and are not automatically cleared: delayed clearing is unreliable,
can erase a newer clipboard value, and does not remove copies retained by clipboard managers.
Documentation warns about clipboard history and synchronization.

## Components and errors

A focused `src/key-backup.ts` module owns backup behavior and accepts injected prompt, process, and
clipboard adapters for deterministic tests. `src/cli.ts` only declares flags and delegates.
Provider failures are sanitized: GitVaulty may display provider stderr, but never provider stdout
from a write operation. Missing clipboard support, headless Linux, invalid provider output, login
failures, and canceled menus all leave the stored identity unchanged.

The command remains global and never inspects or initializes a repository. Tests cover command
surface, mutual exclusion, non-interactive behavior, detection, re-check loops, provider stdin,
Bitwarden session cleanup, clipboard behavior, printing, cancellation, and secret-free errors.

## Release and demo review

At the user's direction, the package version changes from 1.0.0 to 1.1.0. The README and key command
reference will describe the new destinations, flags, provider requirements, and security boundary.

The minor/major release scenario contract in `docs/demo/instructions.md` was reviewed. No captured
scene runs `gitvaulty key backup`, and the changed prompt does not affect repository bootstrap,
access control, file creation, materialization, or `run`. The demo tape, driver, and GIF therefore
remain current and do not need regeneration.
