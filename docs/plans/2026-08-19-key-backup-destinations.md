# Interactive Key Backup Destinations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the confirmed-print backup flow with an interactive destination picker, detected 1Password and Bitwarden integrations, and explicit non-interactive clipboard/print flags.

**Architecture:** Add a testable `key-backup` service that owns prompts, provider detection, secure stdin transfers, and clipboard output. Keep Commander wiring in `src/cli.ts` thin and inject adapters in tests so no real password manager or clipboard is touched.

**Tech Stack:** TypeScript, Commander, Inquirer, cross-spawn, clipboardy, Vitest.

---

### Task 1: Specify command and destination behavior

**Files:**
- Create: `test/key-backup.test.ts`
- Modify: `test/cli_options.test.ts`
- Modify: `test/cli.test.ts`

**Steps:**

1. Write failing tests for the interactive destination menu, cancellation, `--clipboard`, `--print`, mutual exclusion, and flagless non-interactive failure.
2. Write failing tests that both supported password managers are listed, including unavailable entries, and that missing entries offer installation guidance, re-check, and back.
3. Write failing tests proving provider payloads travel through stdin and are absent from arguments, output, and thrown errors.
4. Write failing Bitwarden tests for unauthenticated, locked, already-unlocked, and cleanup paths.
5. Run `npm test -- --run test/key-backup.test.ts test/cli_options.test.ts test/cli.test.ts` and confirm the new tests fail for missing behavior.

### Task 2: Implement destination and provider adapters

**Files:**
- Create: `src/key-backup.ts`
- Modify: `src/process.ts`
- Modify: `src/cli.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Steps:**

1. Add `clipboardy` as a runtime dependency.
2. Implement direct binary probes for `op` and `bw`, returning detected/not-found state without invoking a shell.
3. Implement the destination and provider menus with injectable Inquirer adapters.
4. Implement clipboard and print destinations, reading the identity only after destination selection.
5. Implement 1Password Password-item template mutation and `op item create -` stdin transfer.
6. Implement Bitwarden status handling, interactive unlock capture, Secure Note encoding, stdin creation, and owned-session cleanup.
7. Wire `key backup [--clipboard|--print]` to the service and change its help text.
8. Run the focused tests until all pass.

### Task 3: Document the breaking release

**Files:**
- Modify: `README.md`
- Modify: `docs/commands/key.md`
- Modify: `docs/commands/key-backup.md`
- Modify: `package.json`
- Modify: `package-lock.json`

**Steps:**

1. Document the interactive menus, detected/unavailable provider behavior, authentication expectations, flags, and clipboard warning.
2. Change the package version from `1.0.0` to `2.0.0` and keep the lockfile synchronized.
3. Record that `docs/demo/instructions.md` was compared and no captured scenario changed.
4. Run documentation/help assertions and package smoke tests.

### Task 4: Verify, commit, and integrate

**Files:**
- Verify all changed files.

**Steps:**

1. Run `npm run check` and require a zero exit code.
2. Run `git diff --check` and inspect `git status --short` plus the complete diff.
3. Commit with `feat!: add interactive key backup destinations` and include a breaking-change footer.
4. In the main worktree, merge the worktree commit into `main` without rewriting unrelated history.
5. Run `npm run check` again from the merged `main` worktree.
6. Delete the worktree and its feature branch after verifying the merge.
