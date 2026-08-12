# Packaged CLI Entrypoint Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the npm-installed `gitvaulty` binary execute through symlinks and report the version published in `package.json`.

**Architecture:** Canonicalize the module and argv paths before deciding whether the module is the process entrypoint. Load the authoritative package version from the package root rather than duplicating it in CLI source.

**Tech Stack:** TypeScript, Node.js ESM filesystem/URL APIs, Commander, Vitest, tsup, npm

---

### Task 1: Capture the packaged execution failures

**Files:**
- Modify: `test/cli.test.ts`
- Modify: `src/cli.ts`

**Step 1:** Add tests expecting `isMainModule()` to accept a symlink to the current module path and reject a different path.

**Step 2:** Add a test expecting `createProgram().version()` to equal the root `package.json` version.

**Step 3:** Run `npm test -- test/cli.test.ts` and verify the tests fail because the predicate is absent and the version is hardcoded.

**Step 4:** Implement the predicate with `realpathSync` and `fileURLToPath`, returning false for missing paths, and route the main guard through it.

**Step 5:** Read `package.json` relative to `import.meta.url` and use its version in Commander.

**Step 6:** Run `npm test -- test/cli.test.ts` and verify the focused tests pass.

### Task 2: Strengthen the package smoke gate

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1:** Change the check command to execute the built CLI through an npm-style symlink and assert its version, so the original failure cannot pass the release gate silently.

**Step 2:** Bump package metadata to `0.1.2` because npm versions are immutable.

**Step 3:** Run `npm run check` and verify type checking, all tests, build, symlinked binary execution, and version reporting succeed.

**Step 4:** Inspect the diff and commit the verified correction.

### Task 3: Publish and verify the corrective release

**Files:** None

**Step 1:** Merge the worktree commit into local `main`, remove the worktree, and push `main`.

**Step 2:** Wait for both main CI jobs to pass.

**Step 3:** Publish GitHub Release `v0.1.2`, triggering trusted npm publishing, and wait for that workflow to pass.

**Step 4:** Wait until npm reports `gitvaulty@0.1.2`.

**Step 5:** Install the exact registry version in a fresh temporary directory. Assert package and CLI versions are `0.1.2`, run help, create an isolated age identity, and read its public recipient.
