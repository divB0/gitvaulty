# `gitvaulty materialize`

Create persistent local plaintext copies of encrypted files you can access.

## Usage

```sh
npx gitvaulty materialize [-f <path>...]
```

Examples:

```sh
npx gitvaulty materialize
npx gitvaulty materialize -f .env -f config/secrets.yaml
```

## Selection

| Option | Meaning |
| --- | --- |
| `-f, --file <path>` | Select a logical plaintext path. Repeat to select multiple files. |

With no `--file` options, GitVaulty selects every registered file your current user can access. A selected path must be accessible and cannot be repeated.

## What it does

GitVaulty decrypts the selected ciphertext and inspects each plaintext destination:

- `missing`: creates the plaintext file with mode `0600`;
- `current`: leaves identical bytes in place and enforces mode `0600`;
- `modified`, `tracked`, or `unsafe`: stops without overwriting the destination.

GitVaulty validates all selected files before creating any missing plaintext. If creation later fails partway through, plaintext files created by that attempt are cleaned up when still unchanged.

Every selected plaintext path is added to the clone-local `.git/info/exclude`. This does not modify the committed `.gitignore`, and other clones do not inherit the entries.

## Safety behavior

The command rejects symlinked paths, non-regular destinations, Git-tracked plaintext, local bytes that differ from the encrypted source, missing ciphertext, and unauthorized selections. It never silently overwrites plaintext.

## Related commands

- [`gitvaulty status`](status.md)
- [`gitvaulty clean`](clean.md)
- [`gitvaulty run`](run.md)
- [`gitvaulty edit`](edit.md)
