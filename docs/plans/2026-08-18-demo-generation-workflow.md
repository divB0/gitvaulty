# Demo Generation Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the README access-control GIF reproducible with one npm command and require release work to keep it aligned with user-facing behavior.

**Architecture:** Add a repository-root shell wrapper that validates external tools, builds the current CLI, runs the checked-in VHS tape, and verifies that the expected GIF was produced. Document the demo's scenario contract and visual review process in `docs/demo/instructions.md`, then make minor and major release work assess that contract in `AGENTS.md`.

**Tech Stack:** npm scripts, Bash, VHS, GitVaulty CLI, Terraform CLI, Markdown.

---

### Task 1: Add the one-command generator

**Files:**
- Create: `scripts/generate-demo.sh`
- Modify: `package.json`

**Step 1: Add the npm entry point**

Add `"demo:generate": "bash scripts/generate-demo.sh"` to the package scripts.

**Step 2: Implement the wrapper**

The wrapper must:

- resolve and enter the repository root so it is independent of the caller's working directory;
- fail with a clear message when `git`, `node`, `npm`, `terraform`, or `vhs` is unavailable;
- run `npm run build` before recording so the GIF uses the current CLI;
- run `vhs demos/access-control.tape`;
- fail if `demos/access-control.gif` is empty or missing;
- print only the generated artifact path, not identities or secret values.

**Step 3: Validate the wrapper syntax**

Run: `bash -n scripts/generate-demo.sh`

Expected: exit status 0.

### Task 2: Document the scenario contract and generation workflow

**Files:**
- Create: `docs/demo/instructions.md`

**Step 1: Document prerequisites and the one-command workflow**

Explain the required CLIs, `npm install`, and `npm run demo:generate`. Describe the build, temporary repository/identity setup, recording, cleanup, and output path.

**Step 2: Document every captured scenario**

List the required sequence:

1. initialize as admin;
2. create `dev` and `sre` groups;
3. register initial developer and SRE users and assign groups;
4. create local `.env` for `dev` and `sre`;
5. create production `.env` for `sre` only;
6. create a Terraform production secret for `sre` only;
7. register a later developer and add them to `dev`;
8. prove that developer materializes local `.env` but cannot decrypt either production secret;
9. prove the SRE can use both SRE-only files with Terraform without leaving plaintext behind.

**Step 3: Add pacing, safety, and review instructions**

Require content-weighted pauses, dummy values only, no plaintext output, no checked-in identities, visual inspection of opening/middle/final frames, and cleanup verification.

### Task 3: Add release maintenance policy

**Files:**
- Modify: `AGENTS.md`

**Step 1: Add the demo release rule**

For every minor or major release, compare user-facing CLI commands, prompts, output, and access-control semantics with `docs/demo/instructions.md`. If any captured behavior changed, update the tape/driver/docs and run `npm run demo:generate`; visually review and commit the regenerated GIF. If none changed, explicitly record that the demo was reviewed and remains current in the release work.

### Task 4: Verify and commit

**Files:**
- Verify: `scripts/generate-demo.sh`
- Verify: `docs/demo/instructions.md`
- Verify: `AGENTS.md`
- Verify: `package.json`
- Verify: `demos/access-control.gif`

**Step 1: Run the actual one-command workflow**

Run: `npm run demo:generate`

Expected: current CLI builds, VHS records successfully, temporary runtime paths are removed, and the GIF is nonempty.

**Step 2: Inspect the regenerated media**

Use `ffprobe` and representative PNG frames to confirm a clean opening, legible access results, the Terraform scenario, and expected dimensions/duration.

**Step 3: Run the project checks**

Run: `npm run check`

Expected: typecheck, all tests, build, and package smoke checks pass.

**Step 4: Review and commit**

Run: `git diff --check && git status --short`, verify only intended files changed, then commit with `docs: add demo generation workflow`.
