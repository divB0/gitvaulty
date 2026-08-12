# Interactive Tracked-File Import Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an opt-in prompt that lets `gitvaulty import` stop tracking a plaintext file and continue through the verified import flow.

**Architecture:** Keep tracked-file rejection in the operations API, but express it as a dedicated error. Add an explicit operations helper that locally excludes and untracks a normalized path, then have a small CLI orchestration function catch only that error, confirm with the user, and retry the original import operation.

**Tech Stack:** TypeScript, Commander, `@inquirer/prompts`, Vitest, Git CLI

---

### Task 1: Describe and type the recoverable condition

**Files:**
- Modify: `src/errors.ts`
- Modify: `src/operations.ts`
- Test: `test/operations.test.ts`

**Step 1:** Add a failing test that expects a tracked import to throw `TrackedPlaintextError` with the normalized plaintext path.

**Step 2:** Run `npm test -- test/operations.test.ts` and confirm the new assertion fails because the error type does not exist.

**Step 3:** Add `TrackedPlaintextError` and throw it from both import and update tracked-file checks.

**Step 4:** Run `npm test -- test/operations.test.ts` and confirm it passes.

### Task 2: Add explicit untracking and CLI recovery

**Files:**
- Modify: `src/operations.ts`
- Modify: `src/cli.ts`
- Test: `test/operations.test.ts`

**Step 1:** Add failing tests for accepting and declining the tracked-file recovery prompt. Assert plaintext preservation, index state, encrypted content, exclusion, and no changes after decline.

**Step 2:** Run `npm test -- test/operations.test.ts` and confirm the new tests fail because recovery is not implemented.

**Step 3:** Add `stopTrackingPlaintext` to normalize, exclude, and run `git rm --cached`. Add an exported CLI orchestration function with an injectable confirmer, warning text, default-no prompt, and one retry.

**Step 4:** Route the import command, including `--update`, through the orchestration function and report a cancellation without a success message.

**Step 5:** Run `npm test -- test/operations.test.ts` and confirm it passes.

### Task 3: Document and verify the complete behavior

**Files:**
- Modify: `README.md`

**Step 1:** Document the interactive prompt, staged index deletion, preserved local file, rotation warning, and the fact that Git history is not rewritten.

**Step 2:** Run `npm run check` and confirm type checking, all tests, the build, and CLI smoke test pass.

**Step 3:** Inspect `git diff --check`, `git status --short`, and the final diff for unintended changes.

**Step 4:** Commit the verified implementation with a scoped message.
