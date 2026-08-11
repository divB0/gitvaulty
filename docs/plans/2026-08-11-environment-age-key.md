# Environment Age Key Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Support `GITVAULTY_KEY` and `SOPS_AGE_KEY` private-key content safely in CI without leaking them to application processes.

**Architecture:** Separate runtime identity resolution from persistent-file operations. Translate the GitVaulty alias into SOPS's standard environment and sanitize the environment at the `gitvaulty run` boundary.

**Tech Stack:** TypeScript, Node.js process/filesystem APIs, age-encryption, SOPS, Vitest

---

### Task 1: Resolve environment identities

**Files:**
- Modify: `src/key.ts`
- Modify: `src/cli.ts`
- Modify: `src/index.ts`
- Modify: `test/key.test.ts`

1. Add failing tests for `GITVAULTY_KEY` precedence, `SOPS_AGE_KEY`, invalid explicit values, public
   recipient derivation, and file-only backup reads.
2. Run `npm test -- --run test/key.test.ts` and confirm failure.
3. Implement runtime `readIdentity` and persistent `readStoredIdentity` APIs. Keep create/restore on
   the resolved file and make CLI backup/restore existence checks use the persistent API.
4. Rerun the focused tests and typecheck, then commit `feat: load age identities from environment`.

### Task 2: Pass keys only to SOPS

**Files:**
- Modify: `src/sops.ts`
- Modify: `src/operations.ts`
- Modify: `test/integration.test.ts`

1. Add a failing integration assertion that an environment identity decrypts the vault but is
   absent from a command launched by `gitvaulty run`.
2. Run `npm test -- --run test/integration.test.ts` and confirm failure.
3. Translate `GITVAULTY_KEY` to `SOPS_AGE_KEY`, avoid injecting a default file for content keys,
   and sanitize all identity-provider variables before spawning the application.
4. Run the focused test and commit `fix: isolate environment age keys`.

### Task 3: Document and verify

**Files:**
- Modify: `README.md`

1. Document both content variables, precedence, CI usage, and the child-process boundary.
2. Run `npm run check`, `git diff --check`, and a source audit for the scrubbed variables.
3. Commit `docs: explain environment age keys`.
