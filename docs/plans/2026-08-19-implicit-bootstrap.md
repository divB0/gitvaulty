# Implicit Repository Bootstrap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make every repository command prepare identity, repository metadata, and the managed agent skill automatically, while retaining an idempotent explicit `init` and shipping the approved `1.0.0` release.

**Architecture:** Add one CLI-owned repository bootstrap routine that composes existing key, initialization, registry, config, and agent-skill primitives. Add a narrowly scoped metadata repair helper so an existing registry is validated and preserved while missing generated files are recreated. Keep global key commands outside repository discovery and keep all bootstrap diagnostics off stdout.

**Tech Stack:** TypeScript, Commander, `@inquirer/prompts`, Vitest, Node.js filesystem APIs, Markdown, Bash/VHS.

---

### Task 1: Specify shared bootstrap behavior with failing tests

**Files:**
- Modify: `test/cli_options.test.ts`
- Modify: `test/agent-skill-preflight.test.ts`
- Modify: `test/registry.test.ts`
- Modify: `test/operations.test.ts`

**Step 1: Write failing CLI tests**

Cover an uninitialized `group create` invocation that selects restore or create when the key is
missing, initializes with a normalized Git-derived or prompted username, synchronizes the skill,
then performs the group command. Cover initialized commands using the same path without rewriting
the registry, idempotent explicit `init`, non-interactive missing-input failures, global key commands
skipping repository discovery, and bootstrap notices avoiding stdout.

**Step 2: Write failing repair and skill tests**

Assert that repository preparation recreates a missing SOPS file from the existing registry without
changing recipients or groups. Replace the approval-oriented skill tests with managed automatic
install/update tests, including non-interactive execution and disabled mode.

**Step 3: Run focused tests to verify they fail**

Run: `npx vitest run test/cli_options.test.ts test/agent-skill-preflight.test.ts test/registry.test.ts test/operations.test.ts`

Expected: FAIL because shared bootstrap, repair, and automatic managed-skill behavior do not exist.

### Task 2: Implement repository repair and automatic skill synchronization

**Files:**
- Modify: `src/registry.ts`
- Modify: `src/operations.ts`
- Modify: `src/agent-skill.ts`
- Modify: `src/cli.ts`
- Modify: `src/repository.ts`

**Step 1: Add conservative SOPS repair**

Expose an `ensureSopsConfig(repo, registry)` operation that writes the generated SOPS configuration
only when it is absent. Add `ensureRepositoryMetadata(repo)` to validate the registry, ensure the
repository config, and invoke SOPS repair.

**Step 2: Make managed skill synchronization automatic**

Refactor `ensureRepositoryAgentSkill` to read the mode, return immediately for `disabled` or
`current`, and otherwise call `installAgentSkill(repo.root, { replace: true })`. Write install/update
notices to stderr through an injectable writer.

**Step 3: Implement the shared bootstrap**

Create a single routine in `src/cli.ts` with this flow:

```ts
const repo = await findRepository();
const recipient = await ensureCliIdentity({ interactive });
if (!await isInitialized(repo)) {
  const username = await resolveBootstrapUsername(repo, { interactive });
  await initialize(repo, { username, recipient });
} else {
  await ensureRepositoryMetadata(repo);
}
await agentSkillPreflight(repo);
return repo;
```

Use it from explicit `init` and all repository commands. Remove duplicated action-level identity
checks. Keep `key` subcommands repository-independent. Route prompts and bootstrap notices through
stderr, and change the non-Git error to the approved wording.

**Step 4: Run focused tests until green**

Run: `npx vitest run test/cli_options.test.ts test/agent-skill-preflight.test.ts test/registry.test.ts test/operations.test.ts`

Expected: PASS.

**Step 5: Commit the functional slice**

Run: `git add -A && git commit -m "feat: bootstrap GitVaulty repository commands"`

### Task 3: Update the public CLI contract and version

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `README.md`
- Modify: `docs/commands/init.md`
- Modify: `docs/commands/key-public.md`
- Modify: `docs/commands/user-list.md`
- Modify: `docs/commands/group-list.md`
- Modify: other `docs/commands/*.md` files that instruct users to run `init` first or describe the old missing-key and skill-confirmation behavior

**Step 1: Bump the approved major version**

Change the package and lockfile package versions from `0.4.0` to `1.0.0` without creating a tag.

**Step 2: Rewrite onboarding and command docs**

Document that `init` is optional and idempotent; repository commands bootstrap automatically; the
missing-key choice supports masked restore, creation, or cancellation; existing registries are
preserved while missing generated metadata is repaired; global key commands still work outside Git;
and managed skills update automatically unless disabled.

**Step 3: Run documentation and command-surface checks**

Run: `git diff --check && npm run typecheck && npm test`

Expected: no whitespace errors, typecheck exit 0, all tests pass.

**Step 4: Commit the release contract**

Run: `git add -A && git commit -m "docs: document automatic GitVaulty bootstrap"`

### Task 4: Update and review the major-release demo

**Files:**
- Modify: `demos/access-control.tape`
- Modify: `docs/demo/instructions.md` if its captured prompt/output contract changes
- Regenerate: `demos/access-control.gif`

**Step 1: Update the tape**

Remove the old managed-skill approval wait and wait for the new automatic install/readiness output.
Keep explicit `init` in the opening scene to demonstrate the optional manual entry point.

**Step 2: Generate the demo**

Run: `npm run demo:generate`

Expected: the VHS run completes and writes a non-empty `demos/access-control.gif`.

**Step 3: Inspect metadata and representative frames**

Run `ffprobe` for dimensions, duration, and frame count, then extract opening, onboarding, access
failure, and final frames with `ffmpeg`. Inspect each image and confirm no private key or plaintext
secret appears.

**Step 4: Verify runtime cleanup**

Run checks confirming `/tmp/gitvaulty-readme-demo`, `/tmp/gitvaulty-readme-keys`, and
`/tmp/gitvaulty-readme-remote.git` do not exist.

### Task 5: Complete release verification and integration

**Files:**
- Verify all changed files

**Step 1: Run the complete release gate**

Run: `npm run check`

Expected: typecheck, all Vitest tests, build, and package smoke test pass.

**Step 2: Inspect scope and commit**

Run: `git diff --check && git status --short && git diff --stat HEAD~2`

Confirm only the approved implementation, tests, docs, version, plan, tape, and GIF changed. Then
run `git add -A && git commit -m "chore: prepare GitVaulty 1.0.0"` for remaining demo/release files.

**Step 3: Merge and clean up the worktree**

From `/Users/andrea/repos/gitvaulty`, merge `codex/auto-init` into local `main` without disturbing
the pre-existing `package-lock.json` worktree edit. Remove `.worktrees/auto-init` and delete the
feature branch after confirming the merge contains all feature commits.
