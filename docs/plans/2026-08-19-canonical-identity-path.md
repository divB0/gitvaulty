# Canonical Identity Path Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship GitVaulty 2.0.0 with the extensionless global `identity` file as its only default key path.

**Architecture:** Change only the platform-default filename returned by `identityFile`; retain explicit
environment overrides exactly as they work today. Document the required pre-upgrade rename and prove
that the change does not alter identity derivation, repository policy, or ciphertext behavior.

**Tech Stack:** TypeScript, Vitest, npm, GitHub Actions, VHS/ffmpeg demo tooling

---

### Task 1: Lock the strict default-path contract with tests

**Files:**
- Modify: `test/key.test.ts`

**Step 1: Change the path-resolution expectations**

Expect the XDG, Windows APPDATA, and Unix home defaults to end in `gitvaulty/identity`. Keep the two
explicit override expectations unchanged so callers may continue to choose filenames with extensions.

**Step 2: Run the focused test and verify it fails**

Run: `npx vitest run test/key.test.ts`

Expected: the three default-path assertions fail because `src/key.ts` still returns `identity.txt`.

**Step 3: Commit the red test**

Run: `git add test/key.test.ts && git commit -m "test: require canonical identity path"`

### Task 2: Implement the canonical path

**Files:**
- Modify: `src/key.ts`

**Step 1: Change the two platform defaults**

Return `path.join(environment.APPDATA, "gitvaulty", "identity")` on Windows and
`path.join(config, "gitvaulty", "identity")` elsewhere. Do not add probing or fallback logic.

**Step 2: Run the focused test**

Run: `npx vitest run test/key.test.ts`

Expected: all key tests pass.

**Step 3: Commit the implementation**

Run: `git add src/key.ts && git commit -m "feat!: use canonical identity path"`

Include a `BREAKING CHANGE:` footer explaining the rename from `identity.txt` to `identity`.

### Task 3: Document migration and prepare version 2.0.0

**Files:**
- Modify: `README.md`
- Modify: `docs/commands/init.md`
- Modify: `docs/commands/key.md`
- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1: Update default-path documentation**

Replace the Unix and Windows default paths with their extensionless forms. Add a concise 2.0 upgrade
note instructing existing users to rename `identity.txt` to `identity` before upgrading. Clarify that
the identity bytes and encrypted-file recipients do not change, so ciphertext does not need rotation.

**Step 2: Set the release version**

Set the root package and lockfile package versions from `1.2.0` to `2.0.0`. Do not change editor or
plugin package versions.

**Step 3: Check docs and package metadata**

Run: `rg -n "identity\\.txt" README.md docs src test`

Expected: only explicit override examples and test fixture filenames remain; no default-path claim uses
`identity.txt`.

Run: `npm pack --dry-run`

Expected: package metadata reports version `2.0.0`.

**Step 4: Commit release documentation and metadata**

Run: `git add README.md docs/commands/init.md docs/commands/key.md package.json package-lock.json && git commit -m "chore!: prepare GitVaulty 2.0.0"`

### Task 4: Verify the major-release demo contract

**Files:**
- Potentially modify: `demos/access-control.gif`
- Potentially modify: `demos/access-control.tape`
- Potentially modify: `demos/access-control-demo.sh`
- Potentially modify: `docs/demo/instructions.md`

**Step 1: Compare the changed behavior with the scenario contract**

Confirm that the demo uses explicit disposable identity paths and does not show the platform default.
If the visible scenario is unaffected, record that conclusion in the release notes.

**Step 2: Regenerate the demo**

Run: `npm run demo:generate`

Expected: the command succeeds and produces `demos/access-control.gif` without leftover
`/tmp/gitvaulty-readme.*` runtime directories.

**Step 3: Review the generated GIF**

Use `ffprobe` for duration/frame metadata, extract representative frames with `ffmpeg`, and visually
inspect them against every checklist item in `docs/demo/instructions.md`.

**Step 4: Commit only if the deterministic artifact changed**

If tracked demo files differ, validate and commit them with `git commit -m "docs: regenerate 2.0 demo"`.

### Task 5: Complete verification and integrate

**Files:**
- Verify all changed files

**Step 1: Run full checks**

Run: `npm run check`

Expected: typecheck, all Vitest tests, production build, and package smoke test pass.

**Step 2: Inspect the final diff and commits**

Run: `git diff main...HEAD --check && git status --short && git log --oneline main..HEAD`

Expected: no unstaged changes, no whitespace errors, and only scoped commits.

**Step 3: Merge back to local main and remove the worktree**

From the main checkout, merge the feature branch without disturbing the pre-existing `package-lock.json`
change. Verify the merge result, then remove the worktree and delete the feature branch.

### Task 6: Publish and verify GitVaulty 2.0.0

**Files:**
- No further source changes expected

**Step 1: Push main**

Push the integrated commit history to `origin/main`.

**Step 2: Create the GitHub release**

Create and publish tag `v2.0.0` with release notes summarizing the canonical path, the required rename,
and the main user-facing changes since 1.1.0. State that the demo was regenerated and reviewed.

**Step 3: Monitor publication**

Wait for the repository publish workflow, verify `npm view gitvaulty version` returns `2.0.0`, then
verify the Homebrew tap formula reaches `2.0.0` and its validation workflow passes. Do not announce
Homebrew availability until both checks succeed.
