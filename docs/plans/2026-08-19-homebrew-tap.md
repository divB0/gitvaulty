# Homebrew Tap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Publish and document a tested `divB0/homebrew-tap` that installs GitVaulty from its pinned npm release.

**Architecture:** Keep npm as the canonical artifact and install it through a standard Homebrew Node formula. Maintain the separate tap with its own scheduled updater so no cross-repository release token is required.

**Tech Stack:** Homebrew Formula DSL, npm registry tarballs, GitHub Actions, Node.js, Ruby formula tests

---

### Task 1: Document the tap contract in GitVaulty

**Files:**
- Modify: `README.md`
- Modify: `HOW_TO_VERSION.md`

**Step 1: Add platform-aware installation instructions**

Add Homebrew as the recommended macOS installation and retain npm/npx as the cross-platform and CI path.

**Step 2: Add the release verification requirement**

Document that releases must confirm the npm package is published and the tap updater adopts the same version and checksum.

**Step 3: Verify documentation formatting**

Run: `git diff --check`
Expected: exit 0.

**Step 4: Commit**

```bash
git add README.md HOW_TO_VERSION.md docs/plans/2026-08-19-homebrew-tap-design.md docs/plans/2026-08-19-homebrew-tap.md
git commit -m "docs: design Homebrew tap distribution"
```

### Task 2: Create the tap repository and formula

**Files:**
- Create in tap: `Formula/gitvaulty.rb`
- Create in tap: `README.md`

**Step 1: Download the latest npm tarball and compute SHA-256**

Run `npm view gitvaulty version dist.tarball`, download that exact URL, and calculate its SHA-256.

**Step 2: Write the formula**

Use the npm tarball URL and checksum, declare `depends_on "node"`, install with `std_npm_args`, and symlink the generated executable from `libexec/bin`.

**Step 3: Add formula tests**

Assert that `gitvaulty --version` equals the formula version and that `gitvaulty --help` contains the product name.

**Step 4: Document installation and updates**

Document `brew install divB0/tap/gitvaulty`, `brew upgrade gitvaulty`, and the npm-backed release model.

### Task 3: Add tap validation and automatic updates

**Files:**
- Create in tap: `.github/workflows/test.yml`
- Create in tap: `.github/workflows/update.yml`
- Create in tap: `scripts/update-formula.mjs`
- Create in tap: `test/update-formula.test.mjs`
- Create in tap: `package.json`

**Step 1: Write updater tests first**

Test version and checksum replacement, no-op behavior, and rejection of malformed formula content.

**Step 2: Run the updater tests and observe failure**

Run: `npm test`
Expected: failure because the updater is not implemented.

**Step 3: Implement the updater**

Read npm metadata, download the tarball, hash it, update only the formula URL and checksum, and expose a testable pure replacement function.

**Step 4: Run updater tests**

Run: `npm test`
Expected: all tests pass.

**Step 5: Add formula CI**

Validate Ruby syntax, Homebrew style/audit, install the local formula, and run its test on supported runners.

**Step 6: Add scheduled update CI**

Run the updater on a schedule and by manual dispatch, validate changes, and commit only when the formula changed.

**Step 7: Commit and publish the tap**

Commit the repository, create public `divB0/homebrew-tap`, push `main`, and confirm the files through GitHub.

### Task 4: End-to-end validation

**Files:**
- Verify: GitVaulty repository and tap repository

**Step 1: Run GitVaulty checks**

Run: `npm run check`
Expected: all typechecks, tests, builds, and package smoke checks pass.

**Step 2: Audit and install the formula locally**

Run Homebrew syntax/style/audit checks, install from the local formula, run `brew test`, and verify `gitvaulty --version`.

**Step 3: Verify repository state**

Run `git diff --check`, inspect both repositories' status, and confirm the main workspace's unrelated lockfile edit remains untouched.

**Step 4: Merge the GitVaulty documentation commit**

Fast-forward the worktree commit into the main worktree, delete the worktree and branch, and push only after the user requests it.
