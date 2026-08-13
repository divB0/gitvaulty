# Explicit Run Scope Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Require `gitvaulty run` callers to select either all authorized files with `--all` or specific files with repeatable `--file` options.

**Architecture:** Validate scope at the CLI boundary before identity or repository access. Preserve the existing operations contract where an empty file list means all files authorized for the current identity.

**Tech Stack:** TypeScript, Commander, Vitest, Markdown.

---

### Task 1: Specify explicit run scope

**Files:**
- Modify: `test/cli.test.ts`
- Modify: `test/cli_options.test.ts`

1. Assert that `run` exposes both `--file` and `--all`.
2. Add tests proving `--all` passes an empty selection to `runWithFiles`.
3. Add tests proving missing scope and conflicting scopes fail before `runWithFiles` is called.
4. Run the focused CLI tests and confirm the new assertions fail.

### Task 2: Implement CLI validation

**Files:**
- Modify: `src/cli.ts`

1. Add a run-specific options type with an `all` flag.
2. Add `--all` to `run` and validate exactly one selection mode.
3. Pass an empty file list for `--all`, preserving authorization filtering in the operations layer.
4. Run the focused CLI tests and confirm they pass.

### Task 3: Update usage documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/commands/run.md`

1. Replace implicit all-file examples with `run --all -- ...`.
2. Document that `--all` selects every file authorized for the current identity.
3. Document that `--all` and `--file` are mutually exclusive and one is required.
4. Run whitespace checks and the complete project check.

### Task 4: Commit and publish

1. Inspect the final diff and working tree.
2. Commit the implementation, tests, plan, and documentation.
3. Fast-forward local `main`, remove the temporary worktree, and push `main` to `origin`.
