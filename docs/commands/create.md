# `gitvaulty create`

Create a new encrypted file, then edit its initial contents without leaving a persistent plaintext copy in the repository.

## Usage

```sh
npx gitvaulty create <path> [--group <name>...] [--user <username>...]
```

Examples:

```sh
npx gitvaulty create .env
npx gitvaulty create config/secrets.yaml --group platform
npx gitvaulty create service-token.txt --group production --user alice
```

Pass the logical plaintext path. Do not append `.gitvaulty`.

## Access options

| Option | Meaning |
| --- | --- |
| `-g, --group <name>` | Grant access through a group. Repeat to select multiple groups. |
| `-u, --user <username>` | Grant access directly to a user. Repeat to select multiple users. |

When neither option is supplied, access defaults to the registry's default group, initially `team`. When any access option is supplied, only the explicitly named groups and users receive access. Your own user must remain among the effective recipients.

## What it does

1. Prepares GitVaulty automatically and verifies that your age identity is a registered user.
2. Refuses paths outside the repository, internal `.git` or `.gitvaulty` paths, symlinked paths, and names already ending in `.gitvaulty`.
3. Refuses to overwrite an existing plaintext or encrypted file.
4. Registers `<path>.gitvaulty` and its access policy in `.gitvaulty/recipients.json`.
5. Creates a verified SOPS-encrypted empty file at `<path>.gitvaulty`.
6. Adds the logical plaintext path to the clone-local `.git/info/exclude` file.
7. Decrypts into a private temporary directory and opens the file in `$VISUAL`, `$EDITOR`, or the platform default editor.
8. If the contents changed, atomically replaces the ciphertext after encryption and decryption verification.

The encrypted file is created with mode `0600`. The temporary plaintext editing directory is removed when the editor closes. A crash can leave it behind; later GitVaulty commands conservatively clean abandoned editing directories after a grace period.

## Git behavior

The command does not stage or commit anything. Add `<path>.gitvaulty`, `.gitvaulty/recipients.json`, and `.sops.yaml` to Git as appropriate. The plaintext path is excluded only in this clone; `.git/info/exclude` is not committed.

## Existing plaintext files

`create` never imports or overwrites an existing plaintext file. Use [`gitvaulty import`](import.md) instead.

## Related commands

- [`gitvaulty edit`](edit.md)
- [`gitvaulty access`](access.md)
- [`gitvaulty materialize`](materialize.md)
