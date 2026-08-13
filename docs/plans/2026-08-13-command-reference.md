# Command Reference Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Document every GitVaulty CLI command and link the complete command reference from the README.

**Architecture:** Add one Markdown page for every top-level command and every executable `key`, `user`, and `group` subcommand. Keep the README list concise and use it as the navigation index; put detailed syntax, behavior, side effects, safety constraints, and examples in the command pages.

**Tech Stack:** Markdown, GitVaulty's Commander CLI implementation, shell-based link validation, and the existing npm verification suite.

---

### Task 1: Add top-level command pages

**Files:**
- Create: `docs/commands/init.md`
- Create: `docs/commands/create.md`
- Create: `docs/commands/import.md`
- Create: `docs/commands/access.md`
- Create: `docs/commands/edit.md`
- Create: `docs/commands/materialize.md`
- Create: `docs/commands/clean.md`
- Create: `docs/commands/status.md`
- Create: `docs/commands/run.md`

**Steps:**
1. Derive each command's syntax and options from `src/cli.ts`.
2. Derive filesystem, Git, encryption, conflict, and cleanup behavior from `src/operations.ts`.
3. Write a standalone page for each command with examples and related-command links.
4. Compare every page against the corresponding CLI implementation.

### Task 2: Add key, user, and group pages

**Files:**
- Create: `docs/commands/key.md` and four `key-*.md` subcommand pages.
- Create: `docs/commands/user.md` and three `user-*.md` subcommand pages.
- Create: `docs/commands/group.md` and five `group-*.md` subcommand pages.

**Steps:**
1. Write overview pages that link to every child command.
2. Document prompts, identity handling, registry changes, and recipient rotation for each executable subcommand.
3. Cross-link related user, group, access, and key operations.

### Task 3: Add navigation and verify

**Files:**
- Modify: `README.md`

**Steps:**
1. Add a categorized command-reference table linking every page.
2. Check that every local Markdown link resolves.
3. Run `npm run check` and confirm it exits successfully.
4. Review `git diff --check` and the final diff.
5. Commit the documentation with a scoped commit message.
