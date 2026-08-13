# User Self-registration and README Workflows Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add no-access public-key self-registration and document GitVaulty's end-to-end quick start and common workflows.

**Architecture:** Add a narrow registry operation that appends the caller's normalized username and public recipient without changing access policy. Expose it as `gitvaulty user register <username>`, then document the two-person onboarding flow separately from the authorized `group add` operation.

**Tech Stack:** TypeScript, Commander, Vitest, Markdown, age recipients, GitVaulty's version 3 JSON registry.

---

### Task 1: Add the self-registration operation

**Files:**
- Modify: `src/operations.ts`
- Test: `test/operations.test.ts`

**Steps:**
1. Add a failing operation test that registers a public recipient with no group memberships and leaves file recipients unchanged.
2. Run the focused test and confirm the missing operation causes failure.
3. Implement `registerUser` using registry normalization and persistence without the authorized access-mutation path.
4. Add and pass duplicate username and recipient coverage.

### Task 2: Add the CLI command

**Files:**
- Modify: `src/cli.ts`
- Modify: `test/cli.test.ts`
- Modify: `test/cli_options.test.ts`

**Steps:**
1. Add failing expectations for `user register <username>` and its operation call.
2. Run focused CLI tests and confirm failure.
3. Add the command, derive the public recipient from the caller's identity, and print the registered username.
4. Run focused CLI tests and confirm they pass.

### Task 3: Document onboarding and common workflows

**Files:**
- Create: `docs/commands/user-register.md`
- Modify: `docs/commands/user.md`
- Modify: `docs/commands/user-add.md`
- Modify: `docs/commands/key-public.md`
- Modify: `README.md`

**Steps:**
1. Add the command page and cross-links that distinguish public registration from access approval.
2. Add a contents list after the README overview.
3. Expand Quick start through initialization, encryption, committing, self-registration, and group approval.
4. Add concise Common workflows examples for routine file, access, onboarding, and offboarding operations.
5. Validate every local Markdown link.

### Task 4: Verify and integrate

**Files:**
- Review every modified file.

**Steps:**
1. Run `npm run check` and confirm all tests, type checks, builds, and package smoke tests pass.
2. Run `git diff --check` and inspect the complete diff.
3. Commit the validated implementation on the isolated branch.
4. Merge the branch into `main` from the main worktree without including its unrelated `package-lock.json` change.
5. Remove the isolated worktree and branch after the merge.
