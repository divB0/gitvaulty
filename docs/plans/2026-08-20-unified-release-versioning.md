# Unified Release Versioning Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make one root `vX.Y.Z` tag publish the matching GitVaulty npm package, VS Code extension, and JetBrains plugin from the exact tagged commit.

**Architecture:** Keep `package.json` as the canonical version and mechanically synchronize the editor package metadata that external marketplaces require. Both editor release workflows consume `vX.Y.Z`, validate every embedded version against the root package, and check out the requested tag even during manual retries; the JetBrains pipeline publishes the shared GitHub Release, which then triggers the matching npm publication.

**Tech Stack:** Node.js, TypeScript, Vitest, GitHub Actions, VSCE, IntelliJ Platform Gradle Plugin, GitHub CLI

---

### Task 1: Define the unified version contract

**Files:**
- Create: `test/release-versioning.test.ts`
- Modify: `test/jetbrains-release-workflow.test.ts`

**Step 1: Write failing tests**

Assert that the root, VS Code, editor-runtime, JetBrains Gradle, embedded runtime manifest, runtime protocol response, and runtime packager versions are identical. Parse the three release workflows and assert that editor releases accept `v*`, reject their old product-specific tag prefixes, check out `RELEASE_TAG`, and validate the tag against the root package version.

**Step 2: Run the focused tests**

Run: `npm test -- test/release-versioning.test.ts test/jetbrains-release-workflow.test.ts`

Expected: FAIL because the editor packages are still on `0.1.x` and use `vscode-v*` or `jetbrains-v*` tags.

### Task 2: Make the root package version authoritative

**Files:**
- Create: `scripts/sync-editor-versions.mjs`
- Modify: `package.json`
- Modify: `vscode/package.json`
- Modify: `vscode/package-lock.json`
- Modify: `editor-runtime/package.json`
- Modify: `editor-runtime/package-lock.json`
- Modify: `editor-runtime/scripts/package-tools.mjs`
- Modify: `editor-runtime/src/bridge.ts`
- Modify: `editor-runtime/test/bridge.test.ts`
- Modify: `editor-runtime/test/package-tools.test.ts`
- Modify: `jetbrains/build.gradle.kts`
- Modify: `jetbrains/src/main/resources/gitvaulty-runtime-manifest.json`

**Step 1: Implement the synchronizer**

Read the root `package.json` version, validate strict semantic version syntax, and update only the known editor version fields. Support `--check` without writes so CI and `npm run check` fail on drift.

**Step 2: Wire npm version lifecycle commands**

Add `versions:check` and `versions:sync`. Run `versions:check` as part of the root check. Use the npm `version` lifecycle to synchronize and stage the known generated version files whenever `npm version` updates the root package.

**Step 3: Synchronize the current development tree**

Run: `npm run versions:sync`

Expected: all editor metadata moves from `0.1.x` to root version `3.0.0` without changing the root version.

**Step 4: Verify the contract**

Run: `npm run versions:check`

Expected: PASS with no file changes.

### Task 3: Use one release tag across every channel

**Files:**
- Modify: `.github/workflows/jetbrains-release.yml`
- Modify: `.github/workflows/vscode-release.yml`
- Modify: `.github/workflows/publish.yml`
- Modify: `editor-runtime/scripts/package-tools.mjs`
- Modify: `editor-runtime/test/package-tools.test.ts`
- Modify: `jetbrains/src/main/kotlin/io/github/divb0/gitvaulty/runtime/RuntimeManifest.kt`
- Modify: `jetbrains/src/test/kotlin/io/github/divb0/gitvaulty/runtime/RuntimeManifestTest.kt`

**Step 1: Move both editor workflows to `v*`**

Derive the expected version by stripping only the leading `v`, compare it with root and editor metadata, and use `actions/checkout` with the exact `RELEASE_TAG` in every release job. Add an explicit tag input to the VS Code recovery dispatch.

**Step 2: Publish a shared GitHub Release**

Rename the JetBrains workflow to `GitVaulty release`, use `CHANGELOG.md` for release notes, title the release `GitVaulty X.Y.Z`, and retain JetBrains Marketplace publication after the public runtime assets exist.

**Step 3: Restrict npm publication**

Run the npm publication job only for published releases whose tag starts with `v`, check out that tag, and verify the release tag equals `package.json` before `npm publish`.

**Step 4: Accept unified immutable runtime URLs**

Generate and validate runtime URLs under `/releases/download/vX.Y.Z/` and update their tests.

**Step 5: Run focused workflow and runtime tests**

Run: `npm test -- test/release-versioning.test.ts test/jetbrains-release-workflow.test.ts`

Run: `npm --prefix editor-runtime test`

Expected: PASS.

### Task 4: Document and repair the full release train

**Files:**
- Create: `CHANGELOG.md`
- Modify: `HOW_TO_VERSION.md`
- Modify: `jetbrains/README.md`
- Modify: `vscode/README.md`
- Modify: `vscode/CHANGELOG.md`
- Modify: `jetbrains/CHANGELOG.md`
- Modify: `jetbrains/src/main/resources/META-INF/plugin.xml`
- Modify: `vscode/src/test/suite/editor-host.ts`

**Step 1: Add canonical release notes**

Seed the root changelog with the published 3.0.0 summary. Explain that each future release adds a version section there and relevant editor notes before running `npm version`.

**Step 2: Document one-tag publication**

Replace product-specific tag instructions with the `npm version <major|minor|patch>` and `git push --follow-tags` flow. Explain that one tag starts npm, VS Code, and JetBrains publication and that tag-specific manual dispatch is recovery-only.

**Step 3: Fix the pre-existing VS Code fixture drift**

Pass the signing key returned by `createIdentity()` into `initialize()`, matching every current core fixture and the required `GitVaultyUser` contract.

**Step 4: Verify the VS Code failure is resolved**

Run: `npm --prefix vscode run typecheck`

Expected: PASS; the previous missing-`signingKey` diagnostic is absent.

### Task 5: Verify, commit, and integrate

**Files:**
- Verify all changed files

**Step 1: Run complete checks**

Run: `npm run check`

Run: `npm --prefix editor-runtime run check`

Run: `npm --prefix vscode run typecheck && npm --prefix vscode test && npm --prefix vscode run build`

Run the JetBrains Gradle tests and package verification with the locally built editor runtime.

Expected: all commands pass.

**Step 2: Inspect the release contract and diff**

Parse every workflow as YAML, run `git diff --check`, and confirm no old `vscode-v` or `jetbrains-v` release instructions remain outside historical plans.

**Step 3: Commit**

```sh
git add -A
git commit -m "ci: unify GitVaulty release versions"
```

**Step 4: Merge and publish the automation**

Fast-forward the worktree commit into local `main`, remove the clean worktree and feature branch, rerun the final contract checks from `main`, and push `main` without including the user's unrelated root `package-lock.json` edit.
