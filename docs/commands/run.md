# `gitvaulty run`

Materialize encrypted files for the lifetime of a child command, then remove the plaintext files GitVaulty created.

## Usage

```sh
npx gitvaulty run [-f <path>...] -- <command> [arguments...]
```

Examples:

```sh
npx gitvaulty run -- npm test
npx gitvaulty run -f .env -- npm run dev
npx gitvaulty run -f config/credentials.json -- node scripts/deploy.js --dry-run
```

Use `--` to separate GitVaulty options from the child command and its options.

## Selection

| Option | Meaning |
| --- | --- |
| `-f, --file <path>` | Select a logical plaintext path. Repeatable. |

With no `--file` options, GitVaulty selects all registered files your current user can access.

## Lifecycle

1. Decrypt and validate every selected file.
2. Create only missing plaintext destinations, with mode `0600`.
3. Add selected paths to the clone-local `.git/info/exclude`.
4. Run the child command from the repository root with inherited terminal input and output.
5. Delete plaintext files created by this invocation if their bytes are unchanged.
6. Return the child command's exit code.

Plaintext files that already existed and matched the ciphertext are available to the child but are not owned or removed by `run`.

## Modified files and failures

If the child changes a plaintext file created by `run`, GitVaulty keeps it and prints a warning instead of deleting work. Use [`gitvaulty import --update`](import.md#updating-an-existing-encrypted-file) to encrypt intentional changes, then [`gitvaulty clean`](clean.md) when appropriate.

Before starting the child, `run` refuses modified, Git-tracked, or unsafe destinations and cleans up any plaintext it created if startup fails partway through. Interrupt signals are forwarded to the child, cleanup runs after it exits, and the signal is then reflected by GitVaulty.

## Child environment

The child inherits the normal environment except for age private-key variables and key-file overrides. GitVaulty removes `GITVAULTY_KEY`, `SOPS_AGE_KEY`, `GITVAULTY_AGE_KEY_FILE`, `SOPS_AGE_KEY_FILE`, and `SOPS_AGE_KEY_CMD` so the wrapped process does not receive your decryption identity through those variables.

## Related commands

- [`gitvaulty materialize`](materialize.md)
- [`gitvaulty clean`](clean.md)
- [`gitvaulty status`](status.md)
