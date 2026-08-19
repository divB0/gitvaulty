# JetBrains First Publication Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Produce a verified, author-signed GitVaulty JetBrains plugin artifact for the mandatory first manual Marketplace upload, publish its native runtime assets, and establish automated updates.

**Architecture:** Extend the existing JetBrains release workflow with a signing job between plugin packaging and GitHub Release creation. The job rebuilds the plugin with the exact five-platform runtime manifest, decrypts SRE-protected release credentials through the registered `github-ci` identity, signs and verifies the artifact, and makes the signed ZIP the public release artifact. JetBrains Marketplace account, vendor, token, and first-upload actions remain external one-time setup; credentials enter Git only as GitVaulty ciphertext and never enter command arguments, logs, or chat.

**Tech Stack:** GitHub Actions, IntelliJ Platform Gradle Plugin 2.x, Marketplace ZIP Signer, GitHub Releases, JetBrains Marketplace, GitVaulty secret handling

---

### Task 1: Record and validate the first-publication workflow

**Files:**
- Create: `docs/plans/2026-08-19-jetbrains-first-publication.md`

**Step 1: Record the signing, release, and first-upload sequence**

Document that the first Marketplace upload is manual, while subsequent releases use `publishPlugin`.

**Step 2: Confirm the CLI demo remains current**

Compare this release with `docs/demo/instructions.md`. The JetBrains distribution workflow does not change CLI commands, prompts, output, or access-control behavior, so the existing demo remains current and does not need regeneration.

**Step 3: Validate and commit**

Run: `git diff --check`

Expected: exit 0.

Commit: `docs: plan first JetBrains Marketplace publication`

### Task 2: Produce a verified signed artifact

**Files:**
- Modify: `.github/workflows/jetbrains-release.yml`
- Modify: `jetbrains/build.gradle.kts`
- Modify: `jetbrains/README.md`

**Step 1: Add the signed-plugin job**

After the five runtimes and manifest-backed plugin package are built, require the GitVaulty CI identity, expose only the three SRE-protected signing files for the Gradle child process, run `signPlugin` and `verifyPluginSignature`, and upload the signed ZIP plus runtime manifest as a flat artifact.

**Step 2: Make the GitHub Release use the signed ZIP**

Make the draft-release job depend on the signing job and publish exactly five native runtime archives, one signed plugin archive, and one runtime manifest.

**Step 3: Preserve automated updates**

Keep `publishPlugin` gated behind the explicit `publish_marketplace` workflow-dispatch input. Document that it is used only after version 0.1.0 has been created manually in Marketplace.

**Step 4: Validate a real signing cycle with an ephemeral test certificate**

Generate a temporary local RSA key and certificate outside the repository. Pass their contents to Gradle only through the child process environment, run `signPlugin verifyPluginSignature`, and confirm the signed ZIP exists. Never print or persist key material in the repository.

**Step 5: Validate repository automation**

Run:

```sh
go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.12 \
  .github/workflows/jetbrains-check.yml \
  .github/workflows/jetbrains-release.yml
./jetbrains/gradlew -p jetbrains test buildPlugin verifyPluginProjectConfiguration verifyPluginStructure --console=plain
npm run check
npm run check --prefix editor-runtime
git diff --check
```

Expected: every command exits 0.

**Step 6: Commit**

Commit: `ci: sign first JetBrains release artifact`

### Task 3: Integrate and publish source

**Files:** None

**Step 1: Rebase the worktree branch onto current local `main` if needed**

Preserve unrelated work and resolve only overlapping release-documentation changes.

**Step 2: Fast-forward the main worktree**

Merge the validated commits into local `main`, remove `.worktrees/jetbrains-first-publish`, and delete the merged branch.

**Step 3: Push main**

Run: `git push origin main`

Expected: GitHub `main` contains the JetBrains runtime, plugin, and signed-release workflow.

### Task 4: Complete one-time JetBrains and GitHub setup

**Files:** None; credentials must never be committed

**Step 1: Complete the JetBrains vendor profile**

In the signed-in Marketplace session, accept the developer agreement, choose the permanent Vendor ID, and have the user make the required trader/non-trader declaration.

**Step 2: Create signing credentials and Marketplace token**

Generate the private key and certificate locally without printing them. Create a permanent Marketplace token in **My Tokens**. Obtain action-time confirmation before creating the persistent token or transmitting any credential.

**Step 3: Initialize SRE-protected release credentials**

Initialize GitVaulty in the repository, create the `sre` group with the human maintainer as manager,
register `github-ci` as a member, and commit the JetBrains credentials only as group-protected
ciphertext. Add only the `github-ci` master identity as the `GITVAULTY_KEY` Actions secret.

### Task 5: Create and verify version 0.1.0

**Files:** None

**Step 1: Create the release tag**

Run:

```sh
git tag -a jetbrains-v0.1.0 -m "GitVaulty for JetBrains 0.1.0"
git push origin jetbrains-v0.1.0
```

Expected: the JetBrains release workflow starts.

**Step 2: Verify workflow outputs**

Confirm all five native runtime jobs, the manifest-backed plugin build, signing, signature verification, and draft-release job pass. Confirm the draft contains seven assets.

**Step 3: Publish the GitHub Release**

Review the user-facing release summary, then obtain action-time confirmation before publishing the draft. Confirm the runtime asset URLs are publicly downloadable.

### Task 6: Submit the first Marketplace release

**Files:** None

**Step 1: Open the new-plugin form**

Select the vendor profile, free/open-source MIT license, source repository URL, relevant security/developer-tool tags, stable channel, and no ads. Keep the release hidden during review if the user prefers.

**Step 2: Upload the signed ZIP**

Read the browser file-upload instructions, obtain action-time confirmation for the upload and public submission, attach the signed `gitvaulty-jetbrains-0.1.0-signed.zip`, and submit it for Marketplace review.

**Step 3: Record the result**

Report the Marketplace plugin page/review state. For version 0.1.1 and later, use the manual **JetBrains plugin release** workflow with `publish_marketplace=true` after publishing the corresponding GitHub runtime release.
