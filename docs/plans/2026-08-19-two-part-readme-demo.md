# Two-Part README Demo Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Produce one README GIF containing a minimal encrypted-file chapter followed by the full access-control chapter.

**Architecture:** Reuse the current VHS tape, disposable repository, identities, and driver. Bootstrap by creating `.env`, prove direct decryption leaves no plaintext file, then evolve the same repository into the existing group-based scenario.

**Tech Stack:** Bash, VHS, GitVaulty CLI, ffmpeg/ffprobe, Markdown, npm

---

### Task 1: Add the first-secret chapter

**Files:**
- Modify: `demos/access-control.tape`
- Modify: `demos/access-control-demo.sh`

1. Change the first visible command from group creation to `gitvaulty create .env` and wait for the
   encrypted-file result.
2. Add an instant chapter label and keep setup hidden.
3. Add a warned `gitvaulty cat .env --force` scene.
4. Add a visible `test ! -e .env` command that prints success only when no plaintext file exists.

### Task 2: Adapt the access-control chapter

**Files:**
- Modify: `demos/access-control-demo.sh`

1. Start the second chapter on a cleared screen and create both `dev` and `sre`.
2. Replace the duplicate `.env` creation with `gitvaulty access .env --group dev --group sre`.
3. Preserve production/Terraform creation and all later registration, grant, denial, and execution
   scenes.
4. Run shell syntax and VHS validation.

### Task 3: Update the README and scenario contract

**Files:**
- Modify: `README.md`
- Modify: `docs/demo/instructions.md`

1. Describe the single GIF as two chapters.
2. Split the scenario contract into first-secret and access-control sections.
3. Add review checks for the chapter transition, direct decryption, absent plaintext, group creation,
   and unchanged access-control evidence.

### Task 4: Regenerate and inspect the GIF

**Files:**
- Modify: `demos/access-control.gif`

1. Run `npm run demo:generate`.
2. Inspect frame zero, the first chapter's decrypted output and absence proof, the second chapter
   heading, representative access-control scenes, and the final frame.
3. Verify that no disposable runtime directory remains.

### Task 5: Verify and commit

**Files:**
- Verify all modified files

1. Run `npm run check`, shell syntax checks, VHS validation, and `git diff --check`.
2. Review status and diff, excluding unrelated changes.
3. Commit the plan and implementation, then merge the worktree commit into `main`.
