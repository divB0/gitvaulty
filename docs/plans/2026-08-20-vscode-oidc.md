# VS Code Marketplace Entra Publishing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the missing VS Code Marketplace PAT with a zero-cost, short-lived Microsoft Entra workload identity.

**Architecture:** Keep the five-platform exact-tag release flow. Bind a user-assigned Azure managed identity to GitHub environment `vscode-marketplace`, authorize it as a Marketplace Contributor, sign in with `azure/login`, and publish through stable `vsce --azure-credential`.

**Tech Stack:** GitHub Actions, GitHub OIDC, Microsoft Entra workload identity federation, Azure managed identity, Visual Studio Marketplace, `@vscode/vsce`, Vitest, YAML

---

### Task 1: Specify the Entra publishing contract

**Files:**
- Modify: `test/release-versioning.test.ts`
- Test: `.github/workflows/vscode-release.yml`
- Test: `.github/workflows/vscode-publisher-identity.yml`

**Step 1: Update the failing workflow test**

Assert that the publish job uses environment `vscode-marketplace`, grants only `contents: read` and
`id-token: write`, signs in with `azure/login` using three repository variables, publishes all five
packages with `--azure-credential`, and never references `VSCE_PAT`, `--pat`, or `--oidc`.

Assert that a manually dispatched identity workflow uses the same environment and Azure login, then
resolves the signed-in identity's Visual Studio Marketplace profile ID.

Assert that `vscode/package.json` pins stable `@vscode/vsce` `3.9.2`.

**Step 2: Run the focused test to verify it fails**

Run: `npm test -- test/release-versioning.test.ts`

Expected: FAIL because the prepared workflow still uses the unavailable direct Marketplace OIDC
path and the identity resolver does not exist.

### Task 2: Implement Entra publication

**Files:**
- Modify: `.github/workflows/vscode-release.yml`
- Create: `.github/workflows/vscode-publisher-identity.yml`
- Modify: `vscode/package.json`
- Modify: `vscode/package-lock.json`
- Modify: `test/release-versioning.test.ts`

**Step 1: Restore stable publisher tooling**

Install exact `@vscode/vsce@3.9.2` in `vscode/` and confirm `npm ci` reproduces it.

**Step 2: Sign in through the managed identity**

Set the publish job environment to `vscode-marketplace`. Keep `contents: read` and `id-token: write`,
then add `azure/login@v2` with:

```yaml
client-id: ${{ vars.AZURE_CLIENT_ID }}
tenant-id: ${{ vars.AZURE_TENANT_ID }}
subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}
```

Publish each package with `npx vsce publish --azure-credential --packagePath "$package"`.

**Step 3: Add the identity resolver**

Create a manually dispatched workflow using the same environment, permissions, and Azure login. Ask
the Visual Studio profile API for the current identity's `id`, require a non-empty result, and emit
it as an Actions notice for one-time Marketplace membership setup. The ID is not a credential.

**Step 4: Run the focused test**

Run: `npm test -- test/release-versioning.test.ts`

Expected: PASS.

### Task 3: Document the secretless release flow

**Files:**
- Modify: `vscode/README.md`
- Modify: `HOW_TO_VERSION.md`
- Modify: `docs/plans/2026-08-20-vscode-oidc-design.md`
- Modify: `docs/plans/2026-08-20-vscode-oidc.md`

Document the GitHub environment and public variables, Azure managed identity, Marketplace Contributor
membership, `--azure-credential`, and identity resolver. State that there is no PAT fallback and that
manual release dispatch remains exact-tag recovery only.

### Task 4: Validate and commit the repository change

Run the focused workflow test, parse both YAML workflows, run `npm ci` in `vscode/`, verify stable
`vsce` supports `--azure-credential`, run `npm run check` at the repository root and in `vscode/`,
then inspect `git diff --check` and commit only the planned files.

### Task 5: Provision the free workload identity

**External state:**
- Azure subscription `Pay-As-You-Go (Main)`
- Azure resource group `gitvaulty-publishing`
- Azure managed identity `gitvaulty-vscode-publisher`
- GitHub repository `divB0/gitvaulty`

Create the resource group in West Europe, create the user-assigned managed identity, and grant it
Reader only at the resource-group scope. Add a federated credential with issuer
`https://token.actions.githubusercontent.com`, audience `api://AzureADTokenExchange`, and subject
`repo:divB0@3007954/gitvaulty@1330015085:environment:vscode-marketplace`. The numeric owner and
repository IDs make the trust immutable even if names change.

Create GitHub environment `vscode-marketplace` and repository variables `AZURE_CLIENT_ID`,
`AZURE_TENANT_ID`, and `AZURE_SUBSCRIPTION_ID`. Do not create a GitHub or Azure secret.

### Task 6: Authorize Marketplace and recover v3.0.1

Merge the validated worktree commits into local `main`, remove the worktree, and push the explicitly
authorized `main` commits. Dispatch `vscode-publisher-identity.yml`, read its non-secret profile ID,
and add that identity to Marketplace publisher `divB0` with Contributor role.

Dispatch `.github/workflows/vscode-release.yml` at the existing `v3.0.1` tag, watch it to completion,
and verify all five platform packages and Marketplace version `3.0.1`. The earlier attempt failed
before uploading any package, so this exact recovery is safe.
