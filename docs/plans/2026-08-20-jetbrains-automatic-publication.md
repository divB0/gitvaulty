# Automatic JetBrains Publication Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make a pushed `jetbrains-v<version>` tag publish both the signed GitHub Release and the matching Stable-channel JetBrains Marketplace update without a second manual action.

**Architecture:** Keep the existing five-platform build and signing pipeline, but make the GitHub Release public instead of draft and make Marketplace publication run automatically for tag pushes. Order the Marketplace job after the GitHub Release job so the runtime URLs embedded in the plugin are public before JetBrains receives the plugin; retain the existing manual dispatch input as a recovery path.

**Tech Stack:** GitHub Actions, GitHub CLI, IntelliJ Platform Gradle Plugin, Vitest, YAML

---

### Task 1: Specify the automatic release contract

**Files:**
- Create: `test/jetbrains-release-workflow.test.ts`
- Test: `.github/workflows/jetbrains-release.yml`

**Step 1: Write the failing workflow test**

Parse `.github/workflows/jetbrains-release.yml` with the repository's `yaml` dependency and assert that:

- the GitHub Release job is named `Publish GitHub Release`;
- release notes come from the matching `jetbrains/CHANGELOG.md` section;
- new releases are not created with `--draft`;
- a pre-existing draft is made public with `gh release edit` and `--draft=false`;
- plugin releases do not replace the main GitVaulty release as GitHub's latest release;
- Marketplace publication runs for `push` tag events as well as an opted-in manual dispatch; and
- the Marketplace job depends on `github-release`.

**Step 2: Run the focused test to verify it fails**

Run: `npm test -- test/jetbrains-release-workflow.test.ts`

Expected: FAIL because the current workflow creates a draft and only publishes to Marketplace after a manual dispatch.

**Step 3: Commit the executable contract with the workflow implementation in Task 2**

Do not commit a deliberately failing test by itself.

### Task 2: Publish GitHub and JetBrains releases from the tag workflow

**Files:**
- Modify: `.github/workflows/jetbrains-release.yml`
- Modify: `test/jetbrains-release-workflow.test.ts`

**Step 1: Publish the GitHub Release**

Rename the job to `Publish GitHub Release`. When the release does not exist, use `gh release create` without `--draft`. When it already exists, upload the rebuilt assets and run:

```sh
gh release edit "$RELEASE_TAG" \
  --draft=false \
  --latest=false \
  --notes-file release-notes.md \
  --repo "$GITHUB_REPOSITORY"
```

Extract the matching version section from `jetbrains/CHANGELOG.md` and use it as the release notes.
Pass `--latest=false` so a JetBrains-only release does not replace the main GitVaulty release as the
repository's latest release. This makes reruns idempotent and upgrades drafts created by the
previous workflow.

**Step 2: Run Marketplace publication for tag pushes**

Change the Marketplace job condition to allow every `push` invocation, while retaining `publish_marketplace=true` for manual dispatches. Change its dependency to `github-release` so a Marketplace upload cannot start before the release and runtime assets are public.

**Step 3: Run the focused test to verify it passes**

Run: `npm test -- test/jetbrains-release-workflow.test.ts`

Expected: PASS.

**Step 4: Validate the workflow syntax**

Run: `node --input-type=module -e "import fs from 'node:fs'; import { parse } from 'yaml'; const workflow = parse(fs.readFileSync('.github/workflows/jetbrains-release.yml', 'utf8')); if (!workflow?.jobs?.marketplace) process.exit(1)"`

Expected: exit code 0.

### Task 3: Point documentation to the Stable listing and describe the automatic flow

**Files:**
- Modify: `README.md`
- Modify: `jetbrains/README.md`
- Modify: `docs/comparisons/agebox.md`
- Modify: `docs/comparisons/cottage.md`
- Modify: `docs/comparisons/dotenvx.md`

**Step 1: Replace the Marketplace destination**

Replace GitVaulty's general Marketplace URL with:

```text
https://plugins.jetbrains.com/plugin/33659-gitvaulty/versions/stable?noRedirect=true
```

Do not change links for third-party plugins.

**Step 2: Document version synchronization and tag publication**

Update `jetbrains/README.md` to explain that a release requires a version not already present on Marketplace, the plugin/runtime versions and changelog must be updated together, and pushing `jetbrains-v<version>` now publishes the GitHub Release followed by the Marketplace update automatically. Document manual dispatch with `publish_marketplace=true` only as a retry/recovery mechanism.

**Step 3: Verify documentation links and stale instructions**

Run: `rg -n "plugins\\.jetbrains\\.com/plugin/33659-gitvaulty(?!/versions/stable\\?noRedirect=true)|Release draft|then run.*manually" README.md jetbrains/README.md docs/comparisons --pcre2`

Expected: no output.

### Task 4: Verify and integrate

**Files:**
- Verify all modified files

**Step 1: Run the complete repository check**

Run: `npm run check`

Expected: type checking, 126 or more tests, build, and package smoke test all pass.

**Step 2: Inspect the final diff and status**

Run: `git diff --check && git diff --stat && git status --short`

Expected: no whitespace errors and only the planned workflow, test, documentation, and plan files are changed.

**Step 3: Commit the validated change**

```sh
git add .github/workflows/jetbrains-release.yml test/jetbrains-release-workflow.test.ts \
  README.md jetbrains/README.md docs/comparisons docs/plans/2026-08-20-jetbrains-automatic-publication.md
git commit -m "ci: automate JetBrains plugin publication"
```

**Step 4: Merge into local main and clean the worktree**

From the main worktree, merge `codex/jetbrains-auto-publish` into `main` without including the user's unrelated `package-lock.json` edit, then remove `.worktrees/jetbrains-auto-publish` and delete the feature branch.
