# GitVaulty-only key-file override

## Goal

Make `GITVAULTY_AGE_KEY_FILE` the only file-path override GitVaulty accepts for its global master
identity and release the change as GitVaulty 3.0.0.

## Decision

`identityFile` checks `GITVAULTY_AGE_KEY_FILE` and otherwise returns the platform default
extensionless `identity` path. It ignores `SOPS_AGE_KEY_FILE` completely, including when that
variable is the only configured key path. `GITVAULTY_KEY` remains the higher-priority in-memory
master-identity source.

The strict removal was explicitly requested. A deprecation period or compatibility alias would
contradict the required single-override contract. Because 2.0.0 is already published and npm
versions are immutable, this configuration break is released as 3.0.0 under `HOW_TO_VERSION.md`.

## SOPS process isolation

Removing `SOPS_AGE_KEY_FILE` from GitVaulty's identity resolution does not make the variable safe to
pass through. GitVaulty derives a native age key from its master identity and injects that key into
the SOPS subprocess. It continues deleting `SOPS_AGE_KEY_FILE` from the SOPS environment so SOPS
cannot independently load an unintended identity.

Likewise, `gitvaulty run` and the JetBrains release helper continue scrubbing the variable from child
environments. Those are security boundaries, not supported GitVaulty configuration sources.

## Migration and verification

Users of `SOPS_AGE_KEY_FILE` as a GitVaulty master-identity override must rename the environment
variable to `GITVAULTY_AGE_KEY_FILE` before upgrading. The referenced file and identity bytes do not
change, so no repository policy or ciphertext rotation is required.

A focused path-resolution test proves that `SOPS_AGE_KEY_FILE` is ignored while
`GITVAULTY_AGE_KEY_FILE` remains effective. Documentation lists only the supported override and
explains the 3.0 migration. Full typecheck, tests, build, and package smoke verification must pass.
The major-release demo contract is unchanged because it already uses `GITVAULTY_AGE_KEY_FILE` for
explicit disposable paths; the existing reviewed 2.0 recording therefore remains current.
