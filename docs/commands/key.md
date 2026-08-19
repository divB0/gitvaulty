# `gitvaulty key`

Manage the global GitVaulty identity used to derive encryption and signing keys.

## Usage

```sh
npx gitvaulty key <command>
```

## Commands

| Command | Purpose |
| --- | --- |
| [`key create`](key-create.md) | Generate and store one master identity. |
| [`key public`](key-public.md) | Print the public age recipient and signing key. |
| [`key backup`](key-backup.md) | Save the private identity to a password manager, clipboard, or stdout. |
| [`key restore`](key-restore.md) | Restore a backed-up private identity. |

## Identity sources

GitVaulty checks identity sources in this order:

1. `GITVAULTY_KEY`
2. `GITVAULTY_AGE_KEY_FILE`
3. The platform default file

The normal default is `~/.config/gitvaulty/identity`. On Windows, `%APPDATA%\gitvaulty\identity` is used when `APPDATA` is set.

### Upgrade to 3.0

GitVaulty 3.0 no longer treats `SOPS_AGE_KEY_FILE` as a master-identity source. Change the variable
name without changing the referenced file:

```sh
export GITVAULTY_AGE_KEY_FILE=/secure/identity
```

GitVaulty still removes `SOPS_AGE_KEY_FILE` before invoking SOPS or a command wrapped by
`gitvaulty run`, preventing those child processes from loading an unintended private key. Keeping
the same master-identity file preserves its public keys and does not require re-encrypting existing
`*.gitvaulty` files.

### Upgrade from 1.x

GitVaulty 2.0 does not read or move the former `identity.txt` default. Before running 2.0 for the
first time, rename a valid 1.x master identity on Unix-like systems:

```sh
mv ~/.config/gitvaulty/identity.txt ~/.config/gitvaulty/identity
```

On Windows PowerShell:

```powershell
Move-Item "$env:APPDATA\gitvaulty\identity.txt" "$env:APPDATA\gitvaulty\identity"
```

If the extensionless `identity` already exists, do not overwrite it. Confirm which identity should
remain active and preserve the other file as a backup until access is verified. Renaming the same
master identity does not change its age recipient or signing key, so existing `*.gitvaulty` files do
not need to be re-encrypted.

The private backup starts with `GITVAULTY-IDENTITY-`. GitVaulty derives a native age/X25519 key and an Ed25519 signing key just in time and does not cache either derived private key on disk. Repositories store only the public `age1...` recipient and `ed25519:...` verification key.
