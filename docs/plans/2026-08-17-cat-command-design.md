# Cat command design

## Goal

Add a pipe-oriented command that decrypts one authorized GitVaulty file directly to standard
output without materializing plaintext in the repository.

## Interface

`gitvaulty cat <path>` accepts the logical plaintext path, consistent with every other file
command. It writes the exact decrypted bytes to stdout and writes no status text there. Errors and
repository-skill warnings remain on stderr. The command refuses an interactive stdout by default to
reduce accidental terminal disclosure; `--force` explicitly overrides that guard.

The alternative designs were an unrestricted Unix-style command and a new `--stdout` option on
`materialize`. The guarded command is preferable because the requested use case is piping, while a
dedicated verb is easier to discover and does not blur persistent materialization with streaming.

## Implementation

Reuse `readSecretFile`, which already validates repository initialization, normalizes the logical
path, verifies that the current identity is registered and authorized, rejects unsafe encrypted
paths, decrypts binary bytes, and detects concurrent ciphertext replacement. The CLI writes its
returned `Buffer` directly to `process.stdout`; it does not create a plaintext file or add a Git
exclude entry. Unlike interactive repository commands, `cat` does not offer to create a missing
identity because prompts or success messages would corrupt a pipeline.

## Documentation and tests

CLI tests cover command discovery, exact binary output, authorization-operation forwarding,
interactive refusal, and `--force`. Existing operation tests already prove exact binary reads and
ciphertext conflict checks. A command page and README examples document pipeline composition and
the terminal guard. Every comparison table gains a streaming/pipe integration dimension, with
competitor behavior verified against current primary documentation.
