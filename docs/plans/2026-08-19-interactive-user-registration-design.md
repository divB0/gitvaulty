# Interactive User Registration Design

## Goal

Make self-registration convenient without tying usernames to the global cryptographic identity.
`gitvaulty user register` should prompt for the repository username, default to the current operating
system username, and let the user accept or replace that value. Automation can bypass the prompt
with `--username <username>`.

## Command behavior

The preferred interface is `gitvaulty user register [--username <username>]`. With no option in an
interactive terminal, GitVaulty asks `Username`, offering the normalized `USER` environment value as
the default. On Windows, `USERNAME` is the fallback. An invalid system value is not offered; the user
must enter a valid name. The existing positional `gitvaulty user register <username>` form remains
accepted so the minor release does not break scripts. Supplying both forms is rejected as ambiguous.

When neither form is provided non-interactively, the command fails before changing repository state
and tells the caller to pass `--username`. All chosen values continue through the existing username
normalization and registration operations. The username is repository metadata only: no username is
stored in the global identity file, and key creation, derivation, backup, and restore remain unchanged.

## Demo and documentation

The demo will show `gitvaulty user register` for Alice, Sam, and Jules. Its persona helper sets the
disposable `USER` value, and the VHS tape presses Enter at each prompt to accept the visible default.
The README and command reference will teach the interactive form first and document `--username` for
automation. Existing positional examples may continue to work, but will no longer be the recommended
syntax.

## Validation and release

CLI tests will cover the system default, a typed replacement, the explicit option, legacy positional
compatibility, conflicting inputs, and non-interactive failure. The full project checks and package
smoke test must pass. Because this is backward-compatible functionality, the package version moves
from 1.1.0 to 1.2.0. The changed onboarding scenario requires regenerating and visually reviewing the
README GIF.
