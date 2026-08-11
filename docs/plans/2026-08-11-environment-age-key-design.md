# Environment age key design

## Goal

CI and service accounts may provide a native age private identity directly through an environment
secret without first writing a key file. Local users retain the global identity file and its
create/backup/restore workflow.

## Identity precedence

Runtime identity resolution uses this order:

1. `GITVAULTY_KEY`, containing one `AGE-SECRET-KEY-...` value;
2. `SOPS_AGE_KEY`, containing one `AGE-SECRET-KEY-...` value;
3. `GITVAULTY_AGE_KEY_FILE` or `SOPS_AGE_KEY_FILE`;
4. the platform-default global GitVaulty identity file.

An explicitly configured but invalid content variable is an error. GitVaulty must not silently
fall back to a file, because that could operate as the wrong user. This iteration accepts one
native identity in the content variable, matching GitVaulty's one-person/one-recipient model.

When `GITVAULTY_KEY` is present, GitVaulty copies its value into `SOPS_AGE_KEY` for SOPS subprocesses.
It overrides an existing `SOPS_AGE_KEY` consistently with GitVaulty's resolution order. A content
identity means no `SOPS_AGE_KEY_FILE` default is injected.

## Key commands

`key public` uses the resolved runtime identity, so it works in CI with either content variable.
Missing-key guards also recognize environment identities and never offer to create a file when one
is present.

`key create`, `key backup`, and `key restore` operate only on the persistent global/override file.
They ignore content variables: CI secret values already have an external backup lifecycle, and
`key backup` must not print an injected environment secret.

## Child-process boundary

SOPS subprocesses receive the resolved identity. Applications launched by `gitvaulty run` do not.
Before spawning the application, GitVaulty removes `GITVAULTY_KEY`, `SOPS_AGE_KEY`,
`GITVAULTY_AGE_KEY_FILE`, `SOPS_AGE_KEY_FILE`, and `SOPS_AGE_KEY_CMD` from the inherited environment.
Vault-rendered variables are then added normally. This prevents the application from reading the
private identity or discovering its provider.

## Verification

Tests cover precedence, valid and invalid content identities, public-recipient derivation,
persistent backup isolation, SOPS environment translation, and child-process scrubbing. An
integration test decrypts through an environment identity and proves the launched application
cannot see either key-content variable.
