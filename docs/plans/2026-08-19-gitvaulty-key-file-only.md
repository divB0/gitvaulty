# GitVaulty-only Key-file Override Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship GitVaulty 3.0.0 with `GITVAULTY_AGE_KEY_FILE` as its only master-identity file override.

**Architecture:** Narrow `identityFile` to GitVaulty's namespaced override and leave all downstream
SOPS environment isolation intact. Update the command documentation and release metadata without
changing identity bytes, repository policy, or ciphertext.

**Tech Stack:** TypeScript, Vitest, npm, GitHub Actions

---

### Task 1: Add the strict resolution regression test

**Files:**
- Modify: `test/key.test.ts`

**Step 1: Change the SOPS-only expectation**

Pass only `SOPS_AGE_KEY_FILE=/secure/sops.txt` and expect the normal home-based
`/home/alice/.config/gitvaulty/identity` path. Keep the `GITVAULTY_AGE_KEY_FILE` assertion unchanged.

**Step 2: Run the focused test and verify it fails**

Run: `npx vitest run test/key.test.ts`

Expected: the resolution test fails because the implementation still returns `/secure/sops.txt`.

**Step 3: Commit the red test**

Run: `git add test/key.test.ts && git commit -m "test: ignore SOPS key-file override"`

### Task 2: Remove the SOPS override from identity resolution

**Files:**
- Modify: `src/key.ts`

**Step 1: Narrow the override**

Resolve only `environment.GITVAULTY_AGE_KEY_FILE`. Do not change SOPS or child-process sanitization.

**Step 2: Run the focused test**

Run: `npx vitest run test/key.test.ts`

Expected: all key tests pass.

**Step 3: Commit the implementation**

Commit with `feat!: require GitVaulty key-file override` and a breaking-change footer describing the
environment-variable rename.

### Task 3: Document migration and prepare 3.0.0

**Files:**
- Modify: `README.md`
- Modify: `docs/commands/key.md`
- Modify: `docs/commands/key-create.md`
- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1: Update identity-source documentation**

Remove `SOPS_AGE_KEY_FILE` from supported identity sources and mounted-master examples. Add a 3.0
upgrade note instructing users to rename that environment variable to `GITVAULTY_AGE_KEY_FILE` while
keeping the same file.

**Step 2: Set version 3.0.0**

Update the root package and root lockfile package versions only.

**Step 3: Verify references**

Run: `rg -n -C 2 "SOPS_AGE_KEY_FILE" src test README.md docs scripts --glob '!docs/plans/**'`

Expected: remaining references only scrub the variable from SOPS or child environments, document that
security behavior, or test it.

**Step 4: Commit**

Commit with `chore!: prepare GitVaulty 3.0.0` and a breaking-change footer.

### Task 4: Verify and integrate

**Files:**
- Verify all changed files

**Step 1: Review the demo contract**

Confirm the demo uses `GITVAULTY_AGE_KEY_FILE` explicitly and no captured command, prompt, output, or
access behavior changes. Record in release notes that the reviewed 2.0 demo remains current.

**Step 2: Run complete checks**

Run: `npm run check`

Expected: typecheck, 125 tests, build, and package smoke pass for version 3.0.0.

**Step 3: Smoke-test environment precedence**

Use a disposable config directory and a deliberately nonexistent `SOPS_AGE_KEY_FILE`; prove the built
CLI creates the master identity at the canonical config path. Do not print the private identity.

**Step 4: Merge and clean up**

Fast-forward the commits into local main while preserving the user's existing unstaged
`package-lock.json` changes. Remove the worktree and feature branch.

### Task 5: Publish and verify 3.0.0

**Files:**
- No further source changes expected

**Step 1: Push main and publish GitHub release `v3.0.0`**

Include a concise summary and the required environment-variable migration in the release notes.

**Step 2: Monitor npm publication**

Wait for the publish workflow and verify npm `latest` and `gitHead` match 3.0.0 and the release commit.

**Step 3: Report Homebrew independently**

Do not claim Homebrew availability. Its updater remains blocked by the separately diagnosed redundant
self-copy bug until the user authorizes a fix in `divB0/homebrew-tap`.
