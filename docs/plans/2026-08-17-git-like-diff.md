# Git-like Secret Diff Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `gitvaulty diff [path...] [--exit-code]` with Git-style unified plaintext output.

**Architecture:** Reuse `prepareFiles` so diff selection, authorization, decryption, and path safety stay identical to `status`. Return differing old/new byte buffers from the operations layer, render text or binary Git-style output in a focused formatter, and keep default versus `--exit-code` behavior in the CLI.

**Tech Stack:** TypeScript, Commander, Node.js buffers/filesystem, `diff` 9.x, Vitest.

---

### Task 1: Add and test Git-style diff formatting

**Files:**
- Create: `src/diff.ts`
- Create: `test/diff.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1: Install the text-diff dependency**

Run: `npm install diff@9.0.0`

Expected: `diff` appears in production dependencies and the lockfile records version 9.0.0.

**Step 2: Write failing formatter tests**

Cover exact output for a changed UTF-8 file, a missing final newline, and binary buffers. Require a
`formatSecretDiff(file, encrypted, local)` function that returns an empty string for identical
buffers, starts text output with `diff --git a/<file> b/<file>`, and returns
`Binary files a/<file> and b/<file> differ` for invalid UTF-8.

**Step 3: Run the focused tests and confirm failure**

Run: `npx vitest run test/diff.test.ts`

Expected: FAIL because `src/diff.ts` does not exist.

**Step 4: Implement the minimal formatter**

Use `TextDecoder("utf-8", { fatal: true })` to distinguish text from binary. Use the `diff`
package's unified patch generation, retain three context lines, remove library-only separators,
and prepend the Git header. Compare buffers before decoding so identical binary files return no
output.

**Step 5: Run focused tests**

Run: `npx vitest run test/diff.test.ts`

Expected: PASS.

### Task 2: Expose safe encrypted-versus-local comparisons

**Files:**
- Modify: `src/operations.ts`
- Modify: `src/index.ts`
- Modify: `test/integration.test.ts`

**Step 1: Write failing integration tests**

Import two fixtures, modify one plaintext file, and assert `diffSecretFiles(repo)` returns only that
file with decrypted encrypted bytes as `oldContent` and local bytes as `newContent`. Add coverage
for positional selection, missing plaintext becoming an empty `newContent`, current files being
omitted, and tracked/unsafe destinations being rejected.

**Step 2: Run the focused test and confirm failure**

Run: `npx vitest run test/integration.test.ts`

Expected: FAIL because `diffSecretFiles` is not exported.

**Step 3: Implement the operation**

Add exported types:

```ts
export interface SecretFileDiff {
  file: string;
  encryptedFile: string;
  oldContent: Buffer;
  newContent: Buffer;
}
```

Implement `diffSecretFiles(repo, plaintextFiles = [])` using `prepareFiles`. Throw the existing
guarded error for `tracked` or `unsafe`, use an empty buffer for `missing`, read the existing local
regular file for `modified`, and omit byte-identical results. Export the function and type from
`src/index.ts`.

**Step 4: Run the focused integration test**

Run: `npx vitest run test/integration.test.ts`

Expected: PASS.

### Task 3: Add the Git-like CLI command

**Files:**
- Modify: `src/cli.ts`
- Modify: `test/cli.test.ts`
- Modify: `test/cli_options.test.ts`

**Step 1: Write failing CLI tests**

Add `diff` to the expected command surface with only `--exit-code`. Mock `diffSecretFiles`, then
verify bare `diff` passes `[]`, positional paths pass through in order, formatted plaintext is
written to stdout, default differences leave the exit code unchanged, and `--exit-code` sets it to
one when results differ.

**Step 2: Run focused CLI tests and confirm failure**

Run: `npx vitest run test/cli.test.ts test/cli_options.test.ts`

Expected: FAIL because the command is missing.

**Step 3: Implement the command**

Register:

```ts
program.command("diff [paths...]")
  .description("Show plaintext changes relative to encrypted files")
  .option("--exit-code", "exit with 1 when differences exist")
```

Prepare the repository and identity, call `diffSecretFiles(repo, paths)`, format each returned
comparison, write non-empty patches to stdout, and set `process.exitCode = 1` only when
`--exit-code` is supplied and at least one comparison differs.

**Step 4: Run focused CLI tests**

Run: `npx vitest run test/cli.test.ts test/cli_options.test.ts`

Expected: PASS.

### Task 4: Document and verify the feature

**Files:**
- Create: `docs/commands/diff.md`
- Modify: `README.md`
- Modify: `docs/commands/status.md`
- Modify: `docs/comparisons/cottage.md`

**Step 1: Write the command reference**

Document bare and path-selected usage, Git-style output, missing-file behavior, binary output,
default exit zero, `--exit-code`, and the explicit fact that output contains plaintext secrets.

**Step 2: Update navigation and comparisons**

Add `diff` to the README command table and related links. Distinguish GitVaulty's new plaintext
diff from `status`, and update the Cottage comparison so it no longer claims GitVaulty lacks
meaningful content diffs.

**Step 3: Run full verification**

Run: `npm run check`

Expected: typecheck, all tests, build, and package smoke test pass.

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only planned files are changed.

**Step 4: Commit implementation**

Run: `git add -A && git commit -m "feat: add git-like secret diff"`

Expected: one implementation commit containing code, tests, dependency metadata, and docs.
