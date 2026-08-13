# Agent Skill Updates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Detect missing or differing repository GitVaulty agent skills before repository commands, offer an explicit install/update choice, and store repository-wide opt-out policy in `.gitvaulty/config.yaml`.

**Architecture:** The packaged `skills/gitvaulty/SKILL.md` remains the canonical source. A normalized SHA-256 digest classifies the repository copy as missing, current, or different; the CLI reconciles that status only for initialized repository commands. A versioned YAML configuration owns the `agentSkill.mode` policy and preserves unrelated YAML settings when the mode changes.

**Tech Stack:** TypeScript, Commander, Inquirer, Node.js crypto/filesystem APIs, `yaml`, Vitest.

---

### Task 1: Versioned repository YAML configuration

**Files:**
- Create: `src/config.ts`
- Modify: `src/repository.ts`
- Modify: `src/operations.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `test/config.test.ts`
- Modify: repository fixtures under `test/`

**Steps:**
1. Add failing tests for the default managed mode, strict version/mode validation, comment and unknown-key preservation, atomic mode updates, and initialization of `.gitvaulty/config.yaml`.
2. Run `npm test -- test/config.test.ts test/operations.test.ts` and confirm the new expectations fail.
3. Add `yaml` as a runtime dependency and implement `readRepositoryConfig`, `ensureRepositoryConfig`, and `writeAgentSkillMode`.
4. Add `configFile` to `Repository` and ensure initialization creates the default configuration without overwriting an existing valid one.
5. Run the focused tests and confirm they pass.
6. Commit with `feat: add repository yaml configuration`.

### Task 2: Content-aware agent skill management

**Files:**
- Modify: `src/agent-skill.ts`
- Modify: `src/index.ts`
- Modify: `test/agent-skill.test.ts`

**Steps:**
1. Add failing tests for missing, current, CRLF-equivalent, and differing skills, plus explicit safe replacement and symlink rejection.
2. Run `npm test -- test/agent-skill.test.ts` and confirm the new expectations fail.
3. Implement normalized SHA-256 inspection of the bundled and repository skill and an explicit atomic installer/updater.
4. Keep replacement opt-in: status inspection never mutates a differing file.
5. Run the focused tests and confirm they pass.
6. Commit with `feat: detect agent skill updates`.

### Task 3: Repository-command preflight

**Files:**
- Modify: `src/cli.ts`
- Modify: `test/cli.test.ts`
- Modify: `test/cli_options.test.ts`

**Steps:**
1. Add failing tests for install/update, skip once, repository-wide disable, non-interactive warning, current-skill silence, and exclusion of global/help/version/uninitialized flows.
2. Run `npm test -- test/cli.test.ts test/cli_options.test.ts` and confirm the new expectations fail.
3. Implement one repository preparation path that reads the YAML policy, checks the skill, prompts only on interactive terminals, and continues after skip or non-interactive warnings.
4. Make `init` create or honor the YAML configuration and run the same reconciliation after core initialization.
5. Ensure differing custom content is never replaced without the explicit install/update selection.
6. Run the focused tests and confirm they pass.
7. Commit with `feat: prompt for agent skill updates`.

### Task 4: Documentation and package verification

**Files:**
- Modify: `README.md`
- Modify: `docs/commands/init.md`
- Modify: `scripts/package-smoke.mjs`

**Steps:**
1. Document `.gitvaulty/config.yaml`, `managed` and `disabled` modes, digest comparison, interactive choices, repository-wide scope, and non-interactive behavior.
2. Extend the package smoke test to prove the published package contains the canonical agent skill.
3. Run `npm run check` and confirm typechecking, all tests, build, and package smoke checks pass.
4. Inspect `git diff --check`, `git status --short`, and the complete diff for unintended changes.
5. Commit with `docs: explain agent skill management`.
6. Merge the worktree branch into local `main`, rerun `npm run check` on merged `main`, and remove the worktree and feature branch.
