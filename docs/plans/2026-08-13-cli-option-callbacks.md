# CLI Option Callback Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make every GitVaulty CLI command receive Commander 15 options without calling `opts()` on a plain options object.

**Architecture:** Keep Commander as the CLI parser and keep the operations layer unchanged. Define narrow option shapes at the CLI boundary, pass those parsed objects directly into access/file selection helpers, and cover the real callback contract through `parseAsync` regression tests.

**Tech Stack:** TypeScript, Commander 15, Vitest

---

### Task 1: Add failing callback regression tests

**Files:**
- Modify: `test/cli.test.ts`

1. Add tests that parse option-only and variadic commands through `createProgram()`.
2. Verify handlers no longer throw `action.opts is not a function` and receive repeated option values.
3. Run the focused CLI test and confirm the new cases fail against the current handlers.

### Task 2: Correct CLI option handling

**Files:**
- Modify: `src/cli.ts`

1. Define simple access and file option types.
2. Change access/file helpers to consume parsed option objects.
3. Update `create`, `import`, `access`, `materialize`, `clean`, `status`, and `run` callbacks to use Commander 15's options argument directly.
4. Run the focused CLI tests and confirm all cases pass.

### Task 3: Validate, commit, and integrate

1. Run `npm run check`, including type checking, all tests, build, and packaged CLI smoke coverage.
2. Inspect `git diff --check` and the staged file set.
3. Commit the fix, fast-forward it into the main worktree, and remove the temporary worktree and branch.
