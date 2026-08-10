# Global Age Identity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace repository-local and SSH identities with one global native age identity and a clear create/public/backup/restore CLI.

**Architecture:** Resolve one platform-aware identity path with environment overrides, and make all key and SOPS operations use it. Keep missing-key prompts in the CLI while library functions remain deterministic and non-interactive.

**Tech Stack:** TypeScript, Node.js filesystem APIs, Commander, Inquirer, age-encryption, SOPS, Vitest

---

### Task 1: Implement global identity storage

**Files:**
- Modify: `src/key.ts`
- Modify: `src/repository.ts`
- Modify: `src/sops.ts`
- Modify: `src/operations.ts`
- Modify: `src/index.ts`
- Modify: `test/registry.test.ts`
- Create: `test/key.test.ts`

1. Write failing tests for default/override path resolution, `0600` creation, public recipient derivation,
   backup reads, restore validation, and overwrite refusal.
2. Run `npm test -- --run test/key.test.ts test/registry.test.ts` and confirm failure.
3. Implement `identityFile`, `createIdentity`, `readIdentity`, `restoreIdentity`, and
   `currentRecipient` around the global path. Remove repository key-path fields and SSH discovery.
4. Make SOPS receive the resolved global path and make vault creation match one current recipient.
5. Rerun the focused tests and commit with `feat: use a global age identity`.

### Task 2: Implement the key lifecycle CLI

**Files:**
- Modify: `src/cli.ts`
- Modify: `test/cli.test.ts`

1. Write failing command-surface and helper tests for `key create`, `key public`, `key backup`, and
   `key restore`, plus confirmation before private-key output or replacement.
2. Run `npm test -- --run test/cli.test.ts` and confirm failure.
3. Add a shared interactive identity guard for `init` and key-required commands. Missing identities
   prompt before creation and print a backup reminder; help and `user list` remain read-only.
4. Rerun the focused test and typecheck, then commit with `feat: add global key lifecycle commands`.

### Task 3: Remove SSH recipients and update the product

**Files:**
- Modify: `src/recipient.ts`
- Modify: `src/registry.ts`
- Modify: `src/cli.ts`
- Modify: `test/recipient.test.ts`
- Modify: `test/registry.test.ts`
- Modify: `test/integration.test.ts`
- Modify: `README.md`

1. Replace mixed-recipient tests with native-age-only acceptance and SSH rejection. Update integration
   coverage to add and remove a second generated age recipient and preserve rollback assertions.
2. Run the focused tests and confirm the old SSH behavior fails the new expectations.
3. Simplify recipient parsing, remove SSH username suggestions and the list key-type column, and
   update onboarding documentation for one global backup and CI overrides.
4. Run `npm run check`, `git diff --check`, and an `rg` audit proving no product code or README
   advertises SSH support.
5. Commit with `feat: standardize on native age recipients`.
