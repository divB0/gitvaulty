# Interactive User Registration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add prompted self-registration with a system-username default and an automation-friendly `--username` option.

**Architecture:** Resolve a registration username at the CLI boundary, then pass the normalized value through the existing repository bootstrap and registration operations. Keep the legacy positional argument as a compatibility input and leave global key storage unchanged.

**Tech Stack:** TypeScript, Commander, Inquirer, Vitest, Bash, VHS, npm

---

### Task 1: Specify registration input behavior

**Files:**
- Modify: `test/cli.test.ts`
- Modify: `test/cli_options.test.ts`

1. Assert that `user register` exposes `--username`.
2. Add failing tests for accepting the system default, typing a different name, passing
   `--username`, preserving the positional input, rejecting both inputs together, and rejecting a
   missing non-interactive username.
3. Run the focused CLI tests and confirm the new cases fail for the expected missing behavior.

### Task 2: Implement username resolution

**Files:**
- Modify: `src/cli.ts`

1. Add a system-username suggestion helper that normalizes `USER`, falls back to `USERNAME`, and
   ignores invalid suggestions.
2. Change the command to `register [legacyUsername]`, add `-u, --username <username>`, and resolve the
   value before repository preparation.
3. Prompt interactively when neither input is supplied; fail clearly when input is unavailable.
4. Reject simultaneous positional and option values.
5. Run the focused tests and typecheck.

### Task 3: Update user documentation and version

**Files:**
- Modify: `README.md`
- Modify: `docs/commands/user-register.md`
- Modify: `docs/commands/key-create.md`
- Modify: `package.json`
- Modify: `package-lock.json`

1. Teach the no-argument interactive flow and document `--username` for automation.
2. Retain a compatibility note for the positional form.
3. Bump the package version from 1.1.0 to 1.2.0 in the manifest and root lockfile package entry.

### Task 4: Update and regenerate the demo

**Files:**
- Modify: `demos/access-control-demo.sh`
- Modify: `demos/access-control.tape`
- Modify: `docs/demo/instructions.md`
- Modify: `demos/access-control.gif`

1. Set the disposable `USER` value to the active persona and run `gitvaulty user register` without
   an argument.
2. Make VHS wait for each registration prompt and press Enter to accept Alice, Sam, and Jules.
3. Update the scenario contract and review checklist.
4. Run `npm run demo:generate`, inspect the prompt frames and frame zero, and verify runtime cleanup.

### Task 5: Verify and commit

**Files:**
- Verify all modified files

1. Run `npm run check`, shell syntax checks, VHS validation, and `git diff --check`.
2. Review the final diff and repository status without including unrelated changes.
3. Commit the implementation and regenerated demo with a release-appropriate message.
