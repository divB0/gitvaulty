# Native Secret Files Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace structured vaults with opaque, independently permissioned `*.gitvaulty` files and provide safe editing, migration, persistent materialization, cleanup, status, and ephemeral run workflows.

**Architecture:** The filename before `.gitvaulty` is always the logical plaintext path. GitVaulty encrypts the complete byte stream through SOPS binary mode, so keys, comments, formatting, and arbitrary file types remain private and round-trip exactly. The registry maps users to encrypted repository-relative paths; all public commands accept plaintext paths and resolve the storage filename internally.

**Tech Stack:** TypeScript, Node.js 20+, Commander, SOPS binary mode with age, Vitest

---

### Task 1: Define opaque storage and per-file access

**Files:**
- Modify: `src/process.ts`
- Modify: `src/registry.ts`
- Modify: `src/sops.ts`
- Modify: `test/registry.test.ts`
- Modify: `test/operations.test.ts`

**Steps:**
1. Add byte-preserving subprocess support and prove arbitrary bytes round-trip through SOPS binary mode.
2. Store normalized repository-relative `*.gitvaulty` paths in registry version 2.
3. Generate one exact SOPS creation rule per encrypted file.
4. Use binary mode for encrypt, decrypt, edit-key updates, and rotation.
5. Run focused registry and operation tests.

### Task 2: Add predictable create, import, and edit workflows

**Files:**
- Rewrite: `src/operations.ts`
- Modify: `test/operations.test.ts`

**Steps:**
1. Make `create <path>` refuse existing plaintext and encrypted files, then create an empty opaque file for the owner.
2. Make `import <path>` require an existing untracked regular file, encrypt and verify its exact bytes, keep the plaintext, and add it to the local Git exclude file.
3. Make `edit <path>` accept the logical plaintext path, decrypt to a `0700` temporary directory under the real filename, invoke the configured editor, atomically re-encrypt changed bytes, and always remove the temporary directory.
4. Reject traversal, Git internals, symlinks, and symlinked parent directories.
5. Run focused operation tests.

### Task 3: Add hybrid materialization lifecycle

**Files:**
- Modify: `src/operations.ts`
- Rewrite: `test/integration.test.ts`

**Steps:**
1. Add `status` states for missing, current, modified, tracked, and unsafe plaintext destinations.
2. Add persistent `materialize`, creating only missing destinations with mode `0600` after preflighting the entire selection.
3. Add `clean`, deleting only untracked regular plaintext files whose bytes still equal the encrypted source.
4. Keep `run` ephemeral: materialize missing files, execute the child with key-provider variables removed, and delete only unchanged outputs that the run created.
5. Default an omitted file selection to every file the current user may access.
6. Run integration tests.

### Task 4: Replace the CLI and documentation

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/index.ts`
- Rewrite: `README.md`
- Modify: `test/cli.test.ts`
- Delete: `src/templates.ts`
- Delete: `test/templates.test.ts`

**Steps:**
1. Expose `init`, `create`, `import`, `edit`, `materialize`, `clean`, `status`, `run`, `key`, and `user`.
2. Accept logical plaintext paths everywhere; allow repeatable optional `--file` on lifecycle commands.
3. Explain opaque whole-file encryption, safe migration, editing, persistent development files, and ephemeral CI/run use.
4. Remove all retired vault, template, structured-value, and encrypted-path-facing documentation.
5. Run the complete project check and whitespace audit.

### Task 5: Integrate the branch

**Files:**
- No source changes expected.

**Steps:**
1. Commit the verified native-file implementation on `codex/native-files`.
2. Merge the worktree commit into local `main` while preserving unrelated main-worktree changes.
3. Run the complete verification suite from the main worktree.
4. Remove `.worktrees/native-files` and delete the merged feature branch.
