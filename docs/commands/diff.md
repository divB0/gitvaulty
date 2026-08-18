# `gitvaulty diff`

Show Git-style plaintext changes between encrypted sources and local plaintext files.

## Usage

```sh
npx gitvaulty diff [path...]
npx gitvaulty diff [path...] --exit-code
```

Examples:

```sh
npx gitvaulty diff
npx gitvaulty diff .env config/secrets.yaml
npx gitvaulty diff --exit-code
```

With no paths, the command checks every encrypted file the current user can access. Positional
paths select specific logical plaintext files. Always omit the `.gitvaulty` suffix.

The encrypted source is the old side and the local plaintext file is the new side. A missing local
file is treated as empty and appears as a deletion. Files whose bytes match produce no output.
Tracked or unsafe local paths, including symlinks and directories, are rejected.

Text changes use unified Git-style output:

```diff
diff --git a/.env b/.env
--- a/.env
+++ b/.env
@@ -1,1 +1,1 @@
-TOKEN=old-value
+TOKEN=new-value
```

If either side is not valid UTF-8, the command reports that the binary files differ without trying
to render their contents.

## Exit status

Like `git diff`, differences do not change the exit status by default. Use `--exit-code` to exit
with status 1 when at least one selected file differs. Operational errors use a nonzero error
status independently of this option.

## Plaintext output

Diff output intentionally contains decrypted secret values. It is written directly to standard
output without redaction, confirmation, or an interactive-terminal restriction. Avoid sending it
to logs, issue text, chat messages, or other unencrypted destinations.

The comparison decrypts in memory and does not create additional plaintext files or modify the
plaintext, ciphertext, registry, or Git state.

## Related commands

- [`gitvaulty status`](status.md)
- [`gitvaulty materialize`](materialize.md)
- [`gitvaulty edit`](edit.md)
