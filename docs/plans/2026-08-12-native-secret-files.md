# Native Secret Files Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace structured vaults and templates with independently permissioned native `*.gitvaulty` files that are materialized only while `gitvaulty run` owns a child command.

**Architecture:** GitVaulty will treat the filename before `.gitvaulty` as the output path and use its native dotenv, JSON, or YAML format when calling SOPS. The recipient registry will map users to encrypted repository-relative file paths. `run` will decrypt selected files, refuse unsafe or differing destinations, create missing plaintext files with mode `0600`, execute the child, and delete only unchanged files that it created.

**Tech Stack:** TypeScript, Node.js 20+, Commander, SOPS with age, Vitest

---

### Task 1: Define native file paths and registry schema

**Files:**
- Modify: `src/repository.ts`
- Modify: `src/registry.ts`
- Modify: `test/registry.test.ts`

**Step 1: Write failing tests**

Add tests proving registry version 2 stores normalized repository-relative `*.gitvaulty` paths in each user's `files` array, generates one exact SOPS creation rule per file, and rejects absolute paths, traversal, duplicates, and the retired vault schema.

**Step 2: Run tests to verify failure**

Run: `npm test -- --run test/registry.test.ts`

Expected: FAIL because the current registry exposes `vaults` and version 1.

**Step 3: Implement the schema**

Add safe repository-path resolution helpers and replace `VaultUser.vaults` with `GitVaultyUser.files`. Generate deterministic exact-path SOPS rules using the recipients authorized for each file.

**Step 4: Run tests to verify success**

Run: `npm test -- --run test/registry.test.ts`

Expected: PASS.

### Task 2: Add native SOPS file operations

**Files:**
- Modify: `src/sops.ts`
- Rewrite: `src/operations.ts`
- Delete: `src/templates.ts`
- Create: `test/operations.test.ts`
- Delete: `test/templates.test.ts`

**Step 1: Write failing tests**

Cover format detection for `.env*`, `.json`, `.yaml`, and `.yml`; rejection of unsupported or escaping paths; creation from empty or existing plaintext; encrypted values with visible keys; editor argument construction; and rollback when SOPS fails.

**Step 2: Run tests to verify failure**

Run: `npm test -- --run test/operations.test.ts`

Expected: FAIL because native file operations do not exist.

**Step 3: Implement minimal native operations**

Make `create` append `.gitvaulty`, import and remove an existing safe plaintext file or initialize an empty native document, and give the current user access. Make `edit` call SOPS with an explicit native input/output type. Update add/remove-user flows to update or rotate every affected file.

**Step 4: Run focused tests**

Run: `npm test -- --run test/operations.test.ts test/registry.test.ts`

Expected: PASS.

### Task 3: Materialize files safely for `run`

**Files:**
- Modify: `src/operations.ts`
- Rewrite: `test/integration.test.ts`

**Step 1: Write failing integration tests**

Test that `run` creates dotenv and Terraform JSON outputs with mode `0600`, exposes them to the child, removes unchanged files on success and failure, preserves an identical pre-existing file, refuses a different or Git-tracked output, preserves a child-modified output with a warning, removes private-key environment variables, and rotates per-file recipients.

**Step 2: Run tests to verify failure**

Run: `npm test -- --run test/integration.test.ts`

Expected: FAIL against the old environment-injection implementation.

**Step 3: Implement the run lifecycle**

Decrypt selected encrypted files in memory, preflight every output before writing any, create missing outputs exclusively, track hashes, run the child with inherited I/O and scrubbed key-provider variables, and clean up only unchanged files owned by the run. Forward common termination signals and retain the child's exit status.

**Step 4: Run focused tests**

Run: `npm test -- --run test/integration.test.ts`

Expected: PASS.

### Task 4: Replace the CLI and public API

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/index.ts`
- Modify: `test/cli.test.ts`

**Step 1: Write failing CLI tests**

Assert the top-level commands are `init`, `create`, `edit`, `run`, `key`, and `user`; `run` requires one or more repeatable `--file` options; and user output labels access as files.

**Step 2: Run tests to verify failure**

Run: `npm test -- --run test/cli.test.ts`

Expected: FAIL because the old `vault` group remains.

**Step 3: Implement CLI changes**

Wire `create <path>`, `edit <path>`, and `run -f <encrypted-file> -- <command...>` to the native operations. Remove vault render/check commands and old exports.

**Step 4: Run focused tests**

Run: `npm test -- --run test/cli.test.ts`

Expected: PASS.

### Task 5: Rewrite the README and verify the release

**Files:**
- Rewrite: `README.md`

**Step 1: Rewrite documentation**

Lead with a no-install `npx gitvaulty init`, `npx gitvaulty create .env`, and `npx gitvaulty run -f .env.gitvaulty -- npm start` quick start. Explain that applications load materialized files, show Node `--env-file` and Terraform auto-tfvars examples, document file-level access and safe cleanup rules, and remove every structured-vault/template reference.

**Step 2: Audit retired concepts**

Run: `rg -n "vault create|vault edit|vault render|vault check|vaultData|renderTemplate|templates/|top-level env" README.md src test`

Expected: no product or active-test matches.

**Step 3: Run complete verification**

Run: `npm run check && git diff --check`

Expected: type checking, all tests, the build, CLI smoke test, and whitespace validation pass.

**Step 4: Commit**

Run: `git add -A && git commit -m "feat: manage native encrypted secret files"`

