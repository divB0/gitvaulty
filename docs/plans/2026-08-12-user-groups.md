# User Groups Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add group-first access control, safe recipient rotation, and a simple CLI for assigning users and encrypted files to groups.

**Architecture:** Registry v3 separates users, groups, and file policies, then resolves effective age recipients from those relationships. A single transactional policy mutation path re-encrypts every file whose effective recipients changed and restores registry plus ciphertext snapshots on failure.

**Tech Stack:** TypeScript, Commander, Inquirer, SOPS/age, Vitest

---

### Task 1: Define and validate registry v3

**Files:**
- Modify: `src/registry.ts`
- Modify: `test/registry.test.ts`

**Step 1: Write the failing tests**

Add cases proving deterministic normalization of users, groups, and file policies; effective recipients through group and direct grants; generated SOPS rules; invalid references; duplicate identities; empty recipient sets; and rejection of registry v2.

**Step 2: Run the focused test**

Run: `npm test -- test/registry.test.ts`

Expected: FAIL because registry v3 types and helpers are not implemented.

**Step 3: Implement the minimal registry model**

Define `GitVaultyUser`, `GitVaultyGroup`, `SecretFileGrant`, and registry v3. Add `normalizeGroupName`, `normalizeFileGrant`, `fileGrantFor`, `usernamesFor`, and group-aware `recipientsFor`. Validate all references and generate one exact SOPS creation rule per file.

**Step 4: Run the focused test**

Run: `npm test -- test/registry.test.ts`

Expected: PASS.

### Task 2: Default new repositories and files to `team`

**Files:**
- Modify: `src/operations.ts`
- Modify: `test/operations.test.ts`

**Step 1: Write the failing tests**

Assert that initialization creates a `team` group with the owner and that create/import register a file policy using `team`. Add explicit group and direct-user policy cases.

**Step 2: Run the focused test**

Run: `npm test -- test/operations.test.ts`

Expected: FAIL on registry v3 expectations.

**Step 3: Implement policy-aware file registration**

Accept optional `{ groups, users }` access on create/import. Resolve absent access to `defaultGroup`, validate the policy through `writeRegistry`, and encrypt with its effective recipients. Replace authorization and default file selection with effective group-aware access.

**Step 4: Run the focused test**

Run: `npm test -- test/operations.test.ts`

Expected: PASS.

### Task 3: Add transactional access mutations

**Files:**
- Modify: `src/operations.ts`
- Modify: `test/integration.test.ts`

**Step 1: Write the failing tests**

Cover group creation/deletion, membership changes, user creation/removal, file policy replacement, re-encryption for the exact recipient set, used/default group deletion refusal, and last-recipient protection.

**Step 2: Run the focused test**

Run: `npm test -- test/integration.test.ts`

Expected: FAIL because group and access operations do not exist.

**Step 3: Implement the transaction helper and operations**

Create a policy mutation helper that computes changed files, decrypts and snapshots them, writes the new registry, re-encrypts with the new recipient set, verifies, and rolls back on error. Build `addUser`, `removeUser`, `createGroup`, `deleteGroup`, `addGroupMember`, `removeGroupMember`, and `setFileAccess` on top of it.

**Step 4: Run the focused test**

Run: `npm test -- test/integration.test.ts`

Expected: PASS.

### Task 4: Add the group-first CLI

**Files:**
- Modify: `src/cli.ts`
- Modify: `test/cli.test.ts`

**Step 1: Write the failing tests**

Assert `create` and `import` expose repeatable `--group` and `--user`; group commands exist; `access <path>` exists; and list formatting shows groups and members clearly.

**Step 2: Run the focused test**

Run: `npm test -- test/cli.test.ts`

Expected: FAIL on missing command surface and formatters.

**Step 3: Implement commands and prompts**

Pass explicit creation policies into operations. Make user onboarding select groups with `team` preselected. Add group management commands and interactive/non-interactive file access editing. Update list output to show group memberships and effective access.

**Step 4: Run the focused test**

Run: `npm test -- test/cli.test.ts`

Expected: PASS.

### Task 5: Verify and integrate

**Files:**
- Modify if needed: `README.md`

**Step 1: Document the workflow**

Describe the default `team` group, group commands, explicit create/import grants, access editing, and automatic key rotation.

**Step 2: Run the complete verification gate**

Run: `npm run check`

Expected: typecheck, all Vitest tests, production build, and CLI help smoke test pass.

**Step 3: Inspect the final diff**

Run: `git status --short && git diff --check && git diff --stat`

Expected: only the planned source, tests, README, and plan documents are changed; no whitespace errors.

**Step 4: Commit**

Commit the implementation with a message matching the group-access scope, merge the worktree commit into local `main`, verify again in the main worktree, and remove `.worktrees/user-groups`.
