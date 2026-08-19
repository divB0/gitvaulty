# Parallel Demo Runtime Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make host-based README demo generation safe to run concurrently from separate Git worktrees.

**Architecture:** The Bash wrapper atomically allocates and owns a unique temporary parent directory, exports child paths for VHS, and removes the parent through an `EXIT` trap. The tape consumes those inherited paths instead of assigning shared absolute paths.

**Tech Stack:** Bash, Node.js, Vitest, VHS, Git, Terraform.

---

### Task 1: Specify parallel runtime isolation

**Files:**
- Create: `test/demo-generation.test.ts`
- Test: `scripts/generate-demo.sh`

**Step 1: Write the failing concurrency test**

Create two temporary fake repository roots containing the generator wrapper, a `demos` directory,
and fake prerequisite commands. Make fake `npm` succeed and fake `vhs` record the exported runtime
paths, pause briefly to overlap both processes, and create the expected GIF.

Launch both wrappers concurrently and assert:

- both exit successfully;
- each fake worktree receives its own GIF;
- the recorded runtime parent paths differ;
- every repo/key/remote path is beneath its owning runtime parent; and
- both runtime parents no longer exist after the wrappers exit.

**Step 2: Run the test to verify it fails**

Run: `npm test -- --run test/demo-generation.test.ts`

Expected: FAIL because both invocations report the fixed shared `/tmp` locations.

### Task 2: Allocate a unique runtime per invocation

**Files:**
- Modify: `scripts/generate-demo.sh`
- Modify: `demos/access-control.tape`

**Step 1: Implement wrapper ownership**

After prerequisite validation, default the temporary parent to `/tmp` and allocate
`demo_runtime_root` with `mktemp -d "$demo_tmp_root/gitvaulty-readme.XXXXXX"`. Export `DEMO_DIR`,
`DEMO_KEYS`, and `DEMO_REMOTE` beneath that root. Replace the fixed-path cleanup with
`rm -rf -- "$demo_runtime_root"` guarded by a non-empty value.

**Step 2: Make the tape consume inherited paths**

Remove the fixed `/tmp` exports and fixed-path deletion. Validate the three inherited variables,
create their required directories, and leave lifecycle cleanup to the wrapper's trap.

**Step 3: Run focused verification**

Run: `bash -n scripts/generate-demo.sh`

Expected: exit status 0.

Run: `npm test -- --run test/demo-generation.test.ts`

Expected: PASS.

### Task 3: Document and regenerate

**Files:**
- Modify: `docs/demo/instructions.md`
- Regenerate: `demos/access-control.gif`

**Step 1: Document concurrency and the isolation boundary**

Explain that each invocation uses a unique `${TMPDIR}` parent, separate worktrees have separate GIF
outputs, cleanup is per invocation, and the host-based workflow is not a security sandbox.

**Step 2: Run complete verification**

Run: `npm run check`

Expected: typecheck, all tests, build, and package smoke pass.

**Step 3: Generate and review the demo**

Run: `npm run demo:generate`

Expected: `demos/access-control.gif` is regenerated and the runtime parent is removed.

Use `ffprobe` and `ffmpeg` to inspect opening, middle, and final frames. Confirm the documented
scenario remains legible and contains no private identity or plaintext secret.

### Task 4: Commit and integrate

**Files:**
- Commit all files above.

**Step 1: Inspect repository state**

Run: `git status --short` and `git diff --check`.

Expected: only the planned demo workflow, tests, documentation, plan, and generated GIF changes.

**Step 2: Commit**

Run: `git add -A && git commit -m "fix: isolate parallel demo runtimes"`.

**Step 3: Merge and clean up**

Fast-forward the worktree commit into local `main`, preserve unrelated main-worktree changes, run
the final verification, remove the worktree, and delete its branch.
