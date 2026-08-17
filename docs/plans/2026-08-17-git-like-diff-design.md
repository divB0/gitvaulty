# Git-like secret diff design

## Goal

Add a `gitvaulty diff` command that compares materialized plaintext files with their encrypted
GitVaulty sources and prints a familiar unified diff containing plaintext secret values.

## Command behavior

The command follows Git's basic diff ergonomics:

```sh
npx gitvaulty diff
npx gitvaulty diff .env config/secrets.yaml
npx gitvaulty diff --exit-code
```

Paths are positional logical plaintext paths. With no paths, the command checks every encrypted
file accessible to the current identity. Differences are printed by default without a warning,
prompt, force option, redaction, or terminal restriction. The default exit code is zero even when
differences exist; `--exit-code` changes it to one when at least one difference exists.

## Comparison and output

GitVaulty reuses the same repository initialization, identity, file-selection, authorization,
symlink, and destination-safety checks as the existing lifecycle operations. It decrypts the
encrypted source in memory, reads an existing safe regular plaintext file, and creates a unified
line diff in memory. A missing plaintext file is treated as empty. Current files produce no
output. Tracked or unsafe plaintext destinations remain errors.

Output uses Git-style headers with logical plaintext paths, such as `a/.env` and `b/.env`, and
contains the real plaintext secret values. Valid UTF-8 files receive a line-oriented unified diff.
If either side is not valid UTF-8, GitVaulty prints a concise Git-style binary-files-differ line
instead of replacing or corrupting bytes.

## Implementation and testing

A small production text-diff dependency provides correct unified diff generation without writing
decrypted comparison files to disk or maintaining a custom diff algorithm. The operations module
returns structured comparison results, while the CLI owns rendering and exit-code behavior.

Tests cover default all-file selection, positional path selection, modified and missing plaintext,
unchanged files, binary differences, unsafe destinations, exact Git-style headers, plaintext
output, and default versus `--exit-code` status. The README and command reference document that
the output intentionally contains plaintext secrets.
