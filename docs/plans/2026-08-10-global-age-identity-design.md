# Global age identity design

## Goal

GitVaulty uses native age keys only. Each person has one global identity, one public recipient, and
one private-key backup across every repository. SSH recipients, repository-local identities, and
recipient-type detection are removed.

## Identity location

The default identity lives at `~/.config/gitvaulty/identity.txt` on Unix-like systems and under the
user application-data directory on Windows. `GITVAULTY_AGE_KEY_FILE` overrides that location for
CI and service accounts. `SOPS_AGE_KEY_FILE` remains a lower-priority compatibility override so
GitVaulty and SOPS use the same identity.

The identity file contains one native `AGE-SECRET-KEY-...` value, is created with mode `0600`, and
is never stored in a repository. Reusing one identity means one backup, but compromise of that key
affects every repository where its public recipient is still authorized. CI should therefore use a
separate service identity through the override.

## Key commands

The public key surface is:

```text
gitvaulty key create
gitvaulty key public
gitvaulty key backup
gitvaulty key restore
```

`create` refuses to overwrite an existing identity and prints the new public `age1...` recipient
plus a backup reminder. `public` prints only the safe, shareable recipient. `backup` requires an
explicit confirmation before printing private key material. `restore` accepts a private backup,
validates it, and asks before replacing an existing identity.

## Missing-key behavior

Commands that require an identity call one shared interactive guard. When the global identity is
missing, the CLI asks `No GitVaulty key found. Create one now?`. Confirmation creates the identity,
prints its location and public recipient, and reminds the user to run `gitvaulty key backup`.
Declining exits without modifying anything.

`key create` and `key restore` handle missing identities directly. Help, version output, and
`user list` remain read-only and never prompt to create a key. Library functions remain
non-interactive and return actionable missing-key errors.

## Users and repositories

The recipient registry stores only validated classic `age1...` recipients. `user add` asks for the
public recipient, username, and vault access. `user list` shows usernames and vaults; a key-type
column is unnecessary. `user remove` retains confirmation and data-key rotation.

Repository discovery no longer calculates or exposes a repository key path. SOPS commands receive
the resolved global identity path through `SOPS_AGE_KEY_FILE`. Vault creation identifies the current
user by matching the global public recipient against the repository registry.

## Verification

Tests cover platform-aware path resolution, environment overrides, file permissions, create/public/
backup/restore behavior, refusal to overwrite, missing-key prompting, age-only registry validation,
and the user command surface. Integration tests prove two global age identities can be added and
removed while vault data remains decryptable and rollback remains transactional.
