# `gitvaulty cat`

Decrypt one encrypted file directly to standard output without creating a plaintext file.

## Usage

```sh
npx gitvaulty cat <path> [--force]
```

Pass the logical plaintext path without the `.gitvaulty` suffix:

```sh
npx gitvaulty cat config/credentials.json | jq .
npx gitvaulty cat manifests/secret.yaml | kubectl apply -f -
```

## Output contract

`cat` writes only the exact decrypted bytes to stdout. It does not decode text, change line endings,
append a newline, or reject binary data. Diagnostics and repository agent-skill warnings go to
stderr, so a successful pipeline receives an uncontaminated byte stream.

The command decrypts in memory. It does not create the logical plaintext path, modify
`.git/info/exclude`, or retain a temporary plaintext file.

## Safety behavior

GitVaulty refuses to write a secret directly to an interactive terminal:

```text
Refusing to print a secret to an interactive terminal. Pipe the output or use --force.
```

Use `--force` only when displaying the plaintext is intentional. The guard cannot control what a
downstream command does with the bytes; avoid tools that log, cache, or persist their input.

The path must name a registered file accessible to the current identity. GitVaulty applies the same
path, authorization, regular-file, symlink, and concurrent-ciphertext checks used by guarded
editing. A missing identity uses the shared restore/create/cancel flow only when interactive input
and a separate diagnostic stream are available; otherwise it fails. Prompts and bootstrap notices
use stderr, keeping stdout safe for pipelines.

## Related commands

- [`gitvaulty run`](run.md) for commands that require native file paths
- [`gitvaulty materialize`](materialize.md) for persistent local plaintext files
- [`gitvaulty edit`](edit.md) for guarded editing
