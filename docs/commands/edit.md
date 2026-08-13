# `gitvaulty edit`

Edit an encrypted file through a private temporary plaintext copy.

## Usage

```sh
npx gitvaulty edit <path>
```

Examples:

```sh
npx gitvaulty edit .env
npx gitvaulty edit config/secrets.yaml
```

Use the logical plaintext path without `.gitvaulty`.

## What it does

1. Confirms that your registered user can access the file.
2. Decrypts the ciphertext into a private system-temporary directory.
3. Opens the normal plaintext filename with `$VISUAL`, `$EDITOR`, or the platform default editor.
4. If the bytes changed, encrypts them, decrypts the result for verification, and atomically replaces `<path>.gitvaulty`.
5. Removes the temporary directory when the editor closes.

If nothing changed, the ciphertext is left untouched. GitVaulty refuses to overwrite ciphertext that changes unexpectedly during guarded editing operations.

## Materialized plaintext conflicts

If a persistent plaintext copy exists and still matches the ciphertext, `edit` updates it after a successful save. If it has independent local changes, the command asks you to choose:

- **Use local changes, then edit:** encrypt the local bytes first, then open them in the editor.
- **Discard local changes, then edit:** restore the encrypted version locally, then open it.
- **Cancel:** make no changes.

Git-tracked plaintext, symlinks, directories, and other unsafe destinations are rejected.

## Temporary plaintext boundary

The temporary file has private permissions and is normally deleted immediately. A crash or forced termination can prevent cleanup. Every later GitVaulty command checks for abandoned `gitvaulty-edit-*` directories and removes only conservative matches after a grace period.

The editor and its extensions can read the decrypted content. See the [VS Code guide](../vscode.md) for the security boundary of virtual editing.

## Git behavior

The updated ciphertext is not automatically staged or committed.

## Related commands

- [`gitvaulty import --update`](import.md#updating-an-existing-encrypted-file)
- [`gitvaulty materialize`](materialize.md)
- [`gitvaulty clean`](clean.md)
