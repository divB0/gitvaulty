# GitVaulty TypeScript CLI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Publish-ready TypeScript npm CLI for managing Git-backed, per-user encrypted vaults and rendering their values into repository files.

**Architecture:** Keep the CLI thin over injectable library operations. Repository conventions determine metadata, encrypted vault, template, and output paths; SOPS and age provide encryption while Git's common metadata directory holds the private identity.

**Tech Stack:** Node.js 20+, TypeScript, tsup, Commander, Inquirer, Vitest, age-encryption, cross-spawn, canonical SOPS platform packages

---

### Task 1: Scaffold the publishable package

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `vitest.config.ts`
- Create: `src/cli.ts`
- Create: `src/index.ts`
- Create: `test/cli.test.ts`

**Steps:**
1. Write a CLI test that expects the program name and the agreed command groups.
2. Run `npm test -- --run test/cli.test.ts` and confirm it fails because the package is absent.
3. Add package metadata, dependencies, build configuration, exports, and executable mapping.
4. Implement a Commander program factory with the exact public command surface.
5. Run the focused test and `npm run typecheck`.
6. Commit with `feat: scaffold TypeScript CLI`.

### Task 2: Implement Git repository paths and local age identities

**Files:**
- Create: `src/git.ts`
- Create: `src/age-key.ts`
- Create: `src/errors.ts`
- Create: `test/git.test.ts`
- Create: `test/age-key.test.ts`

**Steps:**
1. Test repository-root and common-Git-directory resolution in normal repositories and worktrees.
2. Test generation, one-time recovery output data, non-overwrite behavior, import validation, and `0600` permissions.
3. Run the focused tests and confirm failures.
4. Implement injectable Git command execution and age identity storage under `.git/gitvaulty/age/keys.txt`.
5. Re-run focused tests and type checking.
6. Commit with `feat: manage repository age keys`.

### Task 3: Implement registry and generated SOPS rules

**Files:**
- Create: `src/registry.ts`
- Create: `src/paths.ts`
- Create: `test/registry.test.ts`

**Steps:**
1. Test registry schema validation, stable ordering, duplicate rejection, dynamic vault membership, and final-recipient protection.
2. Test `.sops.yaml` generation for `vaults/<name>/vault.sops.json`.
3. Run focused tests and confirm failures.
4. Implement atomic registry writes and deterministic SOPS configuration rendering.
5. Re-run focused tests and type checking.
6. Commit with `feat: add vault recipient registry`.

### Task 4: Bundle and safely invoke SOPS

**Files:**
- Create: `src/sops.ts`
- Create: `test/sops.test.ts`

**Steps:**
1. Test platform-package resolution, unsupported platforms, inherited key overrides, and repository-local key defaults.
2. Test captured and inherited process modes without a shell.
3. Run focused tests and confirm failures.
4. Implement the platform resolver and injectable SOPS runner.
5. Re-run focused tests and type checking.
6. Commit with `feat: add npm-installed SOPS runtime`.

### Task 5: Implement initialization and vault creation/editing

**Files:**
- Create: `src/init.ts`
- Create: `src/vault.ts`
- Create: `test/init.test.ts`
- Create: `test/vault.test.ts`

**Steps:**
1. Test initialization, missing-key onboarding, idempotency, first-user registration, vault-name validation, and duplicate vault refusal.
2. Test vault creation through SOPS stdin without a plaintext temporary file and editing through inherited stdio.
3. Run focused tests and confirm failures.
4. Implement initialization and vault create/edit operations with atomic rollback around metadata changes.
5. Re-run focused tests and type checking.
6. Commit with `feat: initialize and edit encrypted vaults`.

### Task 6: Implement template rendering and freshness checking

**Files:**
- Create: `src/templates.ts`
- Create: `test/templates.test.ts`

**Steps:**
1. Test mirrored output paths, raw and JSON substitutions, missing keys, path traversal refusal, deterministic discovery, `0600` output permissions, and `.git/info/exclude` updates.
2. Test that check reports missing, changed, and current output files without writing.
3. Run focused tests and confirm failures.
4. Implement in-memory decryption, strict template evaluation, atomic rendering, and comparison.
5. Re-run focused tests and type checking.
6. Commit with `feat: render vault templates`.

### Task 7: Implement child-process environment injection

**Files:**
- Create: `src/run.ts`
- Create: `test/run.test.ts`

**Steps:**
1. Test top-level `env` validation, primitive conversion, environment merging, exit-code and signal propagation, and no-shell invocation.
2. Run focused tests and confirm failures.
3. Implement vault decryption and child spawning through cross-spawn.
4. Re-run focused tests and type checking.
5. Commit with `feat: run commands with vault environment`.

### Task 8: Implement user access changes and rotation

**Files:**
- Create: `src/users.ts`
- Create: `test/users.test.ts`

**Steps:**
1. Test adding users to selected vaults, authorized access requirements, removal confirmation, final-recipient refusal, rotation-before-removal ordering, and rollback after SOPS failure.
2. Run focused tests and confirm failures.
3. Implement transactional registry/config/file snapshots around `updatekeys` and rotation.
4. Re-run focused tests and type checking.
5. Commit with `feat: manage vault users and revocation`.

### Task 9: Wire prompts and exact CLI behavior

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/index.ts`
- Modify: `test/cli.test.ts`

**Steps:**
1. Add command-dispatch tests using injected prompts and operations.
2. Run focused tests and confirm failures.
3. Connect all ten commands, secret-safe import prompts, confirmations, helpful errors, and exit codes.
4. Re-run focused tests and type checking.
5. Commit with `feat: wire GitVaulty commands`.

### Task 10: Add integration coverage and project documentation

**Files:**
- Create: `test/integration/vault-flow.test.ts`
- Create: `LICENSE`
- Create: `.github/workflows/ci.yml`
- Modify: `README.md`
- Modify: `package.json`

**Steps:**
1. Add a real-SOPS test for key generation, initialization, vault creation, setting values, rendering, checking, and run environment injection.
2. Run the integration test and fix only demonstrated failures.
3. Document installation, commands, vault layout, templates, hooks/CI, recovery, access changes, revocation limits, and npm publishing.
4. Add MIT licensing, Node platform CI, package keywords, repository metadata, and publication exclusions.
5. Run `npm test`, `npm run typecheck`, `npm run build`, and `npm pack --dry-run`.
6. Commit with `docs: prepare GitVaulty for release`.

### Task 11: Integrate the feature branch

**Files:**
- No source changes expected.

**Steps:**
1. Re-read this plan and verify every required command and safety property against the implementation.
2. Run the complete verification suite again and inspect `git status --short`.
3. Merge `feat/typescript-cli` into `main` from the primary worktree.
4. Push `main` to `origin` and verify the remote commit.
5. Remove `.worktrees/typescript-cli` and prune worktree metadata.
