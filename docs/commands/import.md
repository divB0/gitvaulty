# `gitvaulty import`

Encrypt an existing plaintext file while keeping the plaintext available locally.

## Usage

```sh
npx gitvaulty import <path> [--group <name>...] [--user <username>...]
npx gitvaulty import --update <path>
```

Examples:

```sh
npx gitvaulty import .env
npx gitvaulty import config/credentials.json --group platform --user alice
npx gitvaulty import --update .env
```

Pass the plaintext path without the `.gitvaulty` suffix.

## Options

| Option | Meaning |
| --- | --- |
| `--update` | Replace an already registered encrypted file with the current plaintext bytes. |
| `-g, --group <name>` | Grant access through a group for a new import. Repeatable. |
| `-u, --user <username>` | Grant direct access for a new import. Repeatable. |

For a new import, omitting access options uses the default group. Supplying any access option makes the specified groups and users the complete initial policy. `--update` cannot be combined with `--group` or `--user`; use [`gitvaulty access`](access.md) to change an existing policy.

## New imports

GitVaulty requires the source to be a regular, non-symlinked file inside the repository. It refuses to overwrite an existing `<path>.gitvaulty` file.

It then:

1. Reads the exact plaintext bytes.
2. Registers the file and access policy.
3. Encrypts the whole file to `<path>.gitvaulty`.
4. Decrypts the new ciphertext and verifies an exact byte-for-byte match.
5. Keeps the original plaintext, changes its mode to `0600`, and adds it to `.git/info/exclude`.

Registry and ciphertext changes are rolled back if encryption or verification fails.

## Tracked plaintext warning

If Git already tracks the plaintext, GitVaulty warns that the secret may exist in Git history and asks whether to stop tracking it. Accepting:

- runs `git rm --cached -- <path>`;
- preserves the local file;
- adds it to `.git/info/exclude`;
- continues the verified import.

The deletion is staged if the file was committed. Declining cancels the import without changing the index or creating ciphertext. This does not erase the secret from existing commits or other clones; rotate exposed credentials even if history is later rewritten.

## Updating an existing encrypted file

`--update` treats the current plaintext as authoritative. It requires your user to have access, preserves the existing access policy, encrypts and verifies the new bytes, and atomically replaces the ciphertext. The same tracked-plaintext warning applies.

## Git behavior

The encrypted file, registry, and `.sops.yaml` are not automatically staged or committed. The clone-local exclude entry is not shared with other clones.

## Related commands

- [`gitvaulty create`](create.md)
- [`gitvaulty edit`](edit.md)
- [`gitvaulty status`](status.md)
