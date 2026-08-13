# `gitvaulty status`

Show the state of local plaintext copies relative to their encrypted sources.

## Usage

```sh
npx gitvaulty status [-f <path>...]
```

Examples:

```sh
npx gitvaulty status
npx gitvaulty status -f .env -f config/secrets.yaml
```

With no `--file` options, the command checks every encrypted file your current user can access. Repeat `-f, --file <path>` to select specific logical plaintext paths.

## States

| State | Meaning |
| --- | --- |
| `missing` | No plaintext file exists. |
| `current` | The plaintext bytes exactly match the decrypted source. |
| `modified` | A regular plaintext file exists with different bytes. |
| `tracked` | Git tracks the plaintext path, regardless of whether its bytes match. |
| `unsafe` | The destination exists but is not a safe regular file, such as a symlink or directory. |

Output contains one line per selected file:

```text
current  .env
missing  config/secrets.yaml
modified service-token.txt
```

The comparison requires decryption, so only authorized files can be selected. The command does not change plaintext, ciphertext, the registry, or Git state.

## Related commands

- [`gitvaulty materialize`](materialize.md)
- [`gitvaulty clean`](clean.md)
- [`gitvaulty import --update`](import.md#updating-an-existing-encrypted-file)
