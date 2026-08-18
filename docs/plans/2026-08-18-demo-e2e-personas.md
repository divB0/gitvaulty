# Demo E2E Personas Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the README GIF show four clearly labeled people completing a realistic Git-backed GitVaulty onboarding and access-control workflow.

**Architecture:** Extend the disposable demo environment with a local bare Git remote that stands in for a hosted `origin`. Show self-registration on onboarding branches, pushes for review, admin merges and group grants, commits for encrypted secret changes, and final role-specific access proofs. Every cleared screen starts with the active person's name and role.

**Tech Stack:** Bash, Git, GitVaulty CLI, VHS, Terraform, npm.

---

### Task 1: Add the disposable Git remote

**Files:**
- Modify: `demos/access-control.tape`
- Modify: `scripts/generate-demo.sh`

**Step 1: Prepare the remote in hidden setup**

Add `/tmp/gitvaulty-readme-remote.git` as a disposable bare repository, initialize the working repository on `main`, and configure that bare repository as `origin`.

**Step 2: Extend cleanup**

Remove the working repository, runtime identities, and bare remote both at the end of the tape and from the generator's exit trap.

**Step 3: Label the initialization screen**

Make the first visible line `# User: Admin (repository owner)` before the initialization title and command.

### Task 2: Add persona-aware E2E Git scenes

**Files:**
- Modify: `demos/access-control-demo.sh`

**Step 1: Add persona and Git helpers**

Update `as_user` to select the runtime identity and Git author. Update `section` to print `# User: <name> (<role>)` as the first line after every clear. Add visible helpers for `git` commands, quoted commit messages, and content-weighted pauses.

**Step 2: Publish repository and group setup**

As `admin`, commit and push the initialized repository. Create `dev` and `sre`, add `admin` to both so the approver can manage affected files, then commit and push the group configuration.

**Step 3: Onboard Alice and Sam through Git review**

For each initial user:

1. switch to that person's identity and a new `onboard/<name>` branch;
2. run `gitvaulty user register <name>`;
3. add, commit, and push the public registration;
4. switch back to `admin` on `main` and pull;
5. merge the reviewed onboarding branch;
6. grant the appropriate `dev` or `sre` group;
7. add, commit, and push the access change.

The only identities are `admin`, `alice`, `sam`, and `jules`.

**Step 4: Publish encrypted secret files**

As `admin`, create local `.env` for `dev` and `sre`, create `.env.production` and the Terraform secret for `sre`, then add, commit, and push the encrypted files and policy metadata.

**Step 5: Onboard Jules and prove access**

As `jules`, push a self-registration branch. As `admin`, merge it, grant `dev`, commit, and push. Then show Jules materializing only `.env` and receiving authorization failures for both SRE-only files.

**Step 6: Prove the SRE flow**

As `sam`, run Terraform through `gitvaulty run` with both SRE-only files and show that no plaintext remains.

### Task 3: Document the E2E persona contract

**Files:**
- Modify: `docs/demo/instructions.md`

**Step 1: Document the four people**

State the fixed four-person cast and clarify that `admin` is the repository owner/authorized approver, not a special built-in GitVaulty role.

**Step 2: Document Git review semantics**

Explain that the local bare `origin` makes the recording offline and deterministic, while branch push plus admin merge represents the hosted pull-request review step.

**Step 3: Update scenario and review rules**

Require a persona header after every clear, visible branch/add/commit/push/merge commands, correct authorship, and review of each actor transition.

### Task 4: Regenerate, inspect, and verify

**Files:**
- Modify: `demos/access-control.gif`

**Step 1: Validate shell syntax**

Run: `bash -n demos/access-control-demo.sh scripts/generate-demo.sh`

Expected: exit status 0.

**Step 2: Generate through the supported command**

Run: `npm run demo:generate`

Expected: build and recording succeed; the working repository, identities, and bare remote are removed.

**Step 3: Inspect persona and Git milestones**

Extract representative frames and confirm the clean opening; Alice, Sam, Jules, and Admin headers; onboarding branch pushes; admin merges/group grants; encrypted-secret commit; Jules's access failures; and Sam's Terraform result.

**Step 4: Run project verification**

Run: `npm run check && git diff --check`

Expected: typecheck, 89 tests, build, package smoke, and whitespace checks pass.

**Step 5: Commit and integrate**

Commit the driver, tape, generator, instructions, plan, and GIF as `docs: show end-to-end demo personas`, fast-forward it into `main`, and remove the worktree.
