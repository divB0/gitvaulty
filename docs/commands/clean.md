# `gitvaulty clean`

Remove materialized plaintext files only when they still match their encrypted source.

## Usage

```sh
npx gitvaulty clean [-f <path>...]
```

Examples:

```sh
npx gitvaulty clean
npx gitvaulty clean -f .env -f config/secrets.yaml
```

## Selection

| Option | Meaning |
| --- | --- |
| `-f, --file <path>` | Select a logical plaintext path. Repeatable. |

With no selections, GitVaulty checks all encrypted files your current user can access.

## What it removes

GitVaulty decrypts each selected source and classifies the local plaintext:

- `current`: identical to the encrypted contents; safely deleted;
- `missing`: already absent; ignored;
- `modified`: different local bytes; retained with a warning;
- `tracked`: tracked by Git; retained with a warning;
- `unsafe`: a symlink, directory, or another unsafe destination; retained with a warning.

`clean` never deletes a modified plaintext file. Review it and use [`gitvaulty import --update`](import.md#updating-an-existing-encrypted-file) if the local bytes should become authoritative.

The clone-local `.git/info/exclude` entry is left in place so later materialization remains protected from ordinary Git status output.

## Related commands

- [`gitvaulty status`](status.md)
- [`gitvaulty materialize`](materialize.md)
- [`gitvaulty run`](run.md)
