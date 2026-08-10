# npm Trusted Publishing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Publish GitVaulty releases to npm from GitHub Actions without a long-lived npm token.

**Architecture:** A dedicated release workflow runs only when a GitHub Release is published. GitHub's OIDC identity is authorized by npm for the exact repository and workflow filename, while the package's existing `prepublishOnly` script remains the release quality gate.

**Tech Stack:** GitHub Actions, Node.js 24, npm Trusted Publishing (OIDC)

---

### Task 1: Add the release workflow

**Files:**
- Create: `.github/workflows/publish.yml`

**Steps:**
1. Add a workflow triggered by published GitHub Releases.
2. Grant only `contents: read` and `id-token: write` permissions.
3. Use a GitHub-hosted runner, Node.js 24, and the public npm registry.
4. Install from the lockfile and run `npm publish`; the existing `prepublishOnly` script performs type checking, tests, and the build.

### Task 2: Validate and publish the workflow

**Files:**
- Verify: `.github/workflows/publish.yml`

**Steps:**
1. Parse the workflow as YAML and inspect its diff.
2. Run `npm ci` and the complete `npm run check` suite.
3. Commit the plan and workflow with `ci: publish releases to npm`.
4. Push `main` and verify the workflow exists on `origin/main`.

### Task 3: Authorize the workflow in npm

**Files:**
- No repository changes.

**Steps:**
1. Open the `gitvaulty` package settings in the connected browser.
2. Add GitHub Actions as the trusted publisher for `divB0/gitvaulty` and `publish.yml`.
3. Allow direct `npm publish` and leave the environment restriction empty.
4. Re-open or inspect the saved publisher configuration and verify every field.
