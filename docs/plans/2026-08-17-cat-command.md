# Cat Command Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a guarded, binary-safe `gitvaulty cat <path>` command and document its streaming advantage in every tool comparison.

**Architecture:** Reuse the existing authorized `readSecretFile` operation so decryption, path validation, access control, and ciphertext conflict detection stay centralized. Add only a CLI adapter that enforces the interactive-terminal guard and writes the returned `Buffer` directly to stdout, then describe this separate no-materialization workflow throughout the docs.

**Tech Stack:** TypeScript, Commander, Node.js binary streams, Vitest, Markdown

---

### Task 1: Add the guarded CLI surface

**Files:**
- Modify: `test/cli.test.ts`
- Modify: `test/cli_options.test.ts`
- Modify: `src/cli.ts`

**Step 1: Write the failing command-surface test**

Add `cat` between `edit` and `materialize`, and assert its only option is `--force`.

**Step 2: Write failing behavior tests**

Mock `readSecretFile` with a `Buffer` containing non-UTF-8 bytes. Assert `cat secret.bin` passes the
repository and logical path to the operation and writes exactly that buffer. Set stdout to a TTY
and assert the command refuses before reading unless `--force` is present.

**Step 3: Run the focused tests to verify they fail**

Run: `npx vitest run test/cli.test.ts test/cli_options.test.ts`

Expected: FAIL because `cat` is not registered and `readSecretFile` is not called.

**Step 4: Implement the minimal command**

Import `readSecretFile`, register `cat <path>` with `--force`, reject interactive stdout before
repository preparation, then write `opened.plaintext` directly with `process.stdout.write`. Do not
call `ensureCliIdentity`, because an identity-creation prompt or message would corrupt stdout.

**Step 5: Run the focused tests**

Run: `npx vitest run test/cli.test.ts test/cli_options.test.ts`

Expected: PASS.

### Task 2: Document streaming and comparison advantages

**Files:**
- Create: `docs/commands/cat.md`
- Modify: `README.md`
- Modify: `docs/commands/run.md`
- Modify: `docs/commands/materialize.md`
- Modify: `docs/comparisons/agebox.md`
- Modify: `docs/comparisons/cottage.md`
- Modify: `docs/comparisons/dotenvx.md`

**Step 1: Verify competitor behavior from primary sources**

Confirm whether each tool streams arbitrary decrypted bytes, materializes a temporary file, limits
stdout support to dotenv data, or provides an equivalent terminal guard.

**Step 2: Add the command documentation**

Document usage, pipe examples, binary preservation, stderr separation, authorization, the TTY
refusal and `--force`, missing-identity behavior, and the fact that no plaintext file is created.

**Step 3: Update discovery and workflows**

Add `cat` to the README command reference and common workflows. Cross-link it from `run` and
`materialize` so readers can choose streaming, ephemeral native files, or persistent native files.

**Step 4: Add the comparison dimension**

Add a `Streaming and pipes` row to all three comparison tables, describing GitVaulty's exact binary
stdout path and each competitor's verified behavior without overclaiming.

### Task 3: Verify and commit

**Files:**
- Verify all files changed above

**Step 1: Run focused tests**

Run: `npx vitest run test/cli.test.ts test/cli_options.test.ts test/operations.test.ts`

Expected: PASS.

**Step 2: Run the complete project gate**

Run: `npm run check`

Expected: typecheck, all tests, build, and package smoke test pass.

**Step 3: Inspect the final diff and status**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only planned source, test, and documentation files are modified.

**Step 4: Commit**

Run: `git add -A && git commit -m "feat: add cat command"`

Expected: one implementation commit containing the tested command and documentation.
