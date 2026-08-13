# `gitvaulty key`

Manage the global age identity GitVaulty uses to decrypt files and identify you in repositories.

## Usage

```sh
npx gitvaulty key <command>
```

## Commands

| Command | Purpose |
| --- | --- |
| [`key create`](key-create.md) | Generate and store a new global age identity. |
| [`key public`](key-public.md) | Print the public age recipient for your identity. |
| [`key backup`](key-backup.md) | Print the private identity after confirmation. |
| [`key restore`](key-restore.md) | Restore a backed-up private identity. |

## Identity sources

GitVaulty checks identity sources in this order:

1. `GITVAULTY_KEY`
2. `SOPS_AGE_KEY`
3. `GITVAULTY_AGE_KEY_FILE`
4. `SOPS_AGE_KEY_FILE`
5. The platform default file

The normal default is `~/.config/gitvaulty/identity.txt`. On Windows, `%APPDATA%\gitvaulty\identity.txt` is used when `APPDATA` is set.

The private identity starts with `AGE-SECRET-KEY-` and must never be committed or shared. Repositories store only the corresponding public `age1...` recipient.
