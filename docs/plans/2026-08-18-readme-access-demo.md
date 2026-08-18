# README Access-Control Demo Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a complete nested README table of contents and a reproducible animated terminal demo of GitVaulty's group-based development, production, and Terraform secret access.

**Architecture:** Record the real built CLI with VHS from a checked-in tape, generating identities and dummy plaintext only in runtime temporary paths. Keep the generated GIF and its source tape in `demos/`, embed the GIF near the top of the README, and make the README contents list reflect every section and subsection.

**Tech Stack:** Markdown, VHS, GitVaulty CLI, SOPS/age, Terraform CLI, ffmpeg/ffprobe, npm project checks.

---

### Task 1: Add a reproducible terminal demo

**Files:**
- Create: `demos/access-control.tape`
- Create: `demos/access-control-demo.sh`
- Create: `demos/access-control.gif`

**Step 1: Build the local CLI**

Run: `npm run build`

Expected: `dist/cli.js` and declarations build successfully.

**Step 2: Write the VHS tape and synchronous demo driver**

Create a tape that:

- initializes a temporary Git repository as `admin`;
- creates `dev` and `sre` groups and adds `admin` to both;
- registers an initial developer and SRE with runtime-only identities;
- imports `.env` for `dev` and `sre` only;
- imports `.env.production` and `terraform/prod.auto.tfvars` for `sre` only;
- registers a later developer, adds them to `dev`, and demonstrates that an identity-based default materialization creates only `.env`;
- demonstrates that the later developer cannot decrypt either production file;
- switches to the SRE identity and runs `terraform console` with the temporary Terraform secret, showing only Terraform's sensitive-value marker;
- cleans all runtime demo paths before and after recording.

Use a synchronous shell driver for the visible multi-user sequence so every real CLI command
finishes before the next persona prompt is printed. Clear the terminal between sections to keep the
active result in VHS's captured viewport.

Use dummy values only, never display plaintext secret values, and never write private identities inside the repository.

**Step 3: Generate the GIF**

Run: `vhs demos/access-control.tape`

Expected: VHS exits successfully and writes `demos/access-control.gif`.

**Step 4: Validate the generated media**

Run: `ffprobe -v error -show_entries stream=codec_name,width,height,nb_frames:format=duration,size -of default=noprint_wrappers=1 demos/access-control.gif`

Expected: GIF codec, intended dimensions, nonzero duration/frame count, and a practical README file size.

### Task 2: Add the demo and complete contents list to the README

**Files:**
- Modify: `README.md`

**Step 1: Embed the demo**

Add a `Demo` section after the introduction with descriptive alt text and a relative link to `demos/access-control.gif`.

**Step 2: Expand the table of contents**

Replace the partial flat list with a numbered, nested list similar to Cottage's README. Include every level-two and level-three heading in document order, including the new Demo section and License.

**Step 3: Validate headings and anchors**

Run a local Markdown-link check that extracts README headings, derives GitHub-style anchors, and confirms every local contents link resolves exactly once.

Expected: all contents anchors resolve; no README image target is missing.

### Task 3: Verify the complete documentation change

**Files:**
- Verify: `README.md`
- Verify: `demos/access-control.tape`
- Verify: `demos/access-control.gif`

**Step 1: Visually inspect the animation**

Render representative GIF frames to PNG with ffmpeg and inspect the first, middle, and final states.

Expected: terminal text is legible, commands are not clipped, access failures are visible, and no private keys or plaintext values appear.

**Step 2: Re-run the full project check**

Run: `npm run check`

Expected: typecheck, 89 tests, build, and package smoke test all pass.

**Step 3: Review the diff and repository safety**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only the plan, README, tape, and generated GIF are changed. Confirm there are no plaintext `.env`, Terraform secrets, or private identity files.

### Task 4: Commit and integrate

**Files:**
- Commit: `docs/plans/2026-08-18-readme-access-demo.md`
- Commit: `README.md`
- Commit: `demos/access-control.tape`
- Commit: `demos/access-control-demo.sh`
- Commit: `demos/access-control.gif`

**Step 1: Commit the validated worktree change**

Run: `git add README.md demos/access-control.tape demos/access-control-demo.sh demos/access-control.gif docs/plans/2026-08-18-readme-access-demo.md && git commit -m "docs: add access control demo"`

Expected: one documentation commit; no package version bump because user space is unchanged.

**Step 2: Merge into main and remove the worktree**

From the main worktree, merge the worktree commit into `main`, verify the resulting commit and status, then remove `.worktrees/readme-access-demo` and delete its branch.

Expected: `main` contains the documentation commit and the main worktree is clean.
