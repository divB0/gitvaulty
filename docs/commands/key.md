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
| [`key backup`](key-backup.md) | Print the private identity after confirmation. |
| [`key restore`](key-restore.md) | Restore a backed-up private identity. |

## Identity sources

GitVaulty checks identity sources in this order:

1. `GITVAULTY_KEY`
2. `GITVAULTY_AGE_KEY_FILE`
3. `SOPS_AGE_KEY_FILE`
4. The platform default file

The normal default is `~/.config/gitvaulty/identity.txt`. On Windows, `%APPDATA%\gitvaulty\identity.txt` is used when `APPDATA` is set.

The private backup starts with `GITVAULTY-IDENTITY-`. GitVaulty derives a native age/X25519 key and an Ed25519 signing key just in time and does not cache either derived private key on disk. Repositories store only the public `age1...` recipient and `ed25519:...` verification key.
