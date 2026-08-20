# VS Code Marketplace Entra Publishing Design

## Goal

Publish every tagged GitVaulty VS Code extension release from GitHub Actions without a long-lived
Visual Studio Marketplace personal access token and without adding a paid Azure resource.

## Decision

Use Microsoft Entra workload identity federation, the currently supported Marketplace automation
path. A user-assigned managed identity named `gitvaulty-vscode-publisher` lives in the
`gitvaulty-publishing` resource group. Its federated credential accepts GitHub OIDC tokens only from
the `divB0/gitvaulty` repository when a job uses the `vscode-marketplace` GitHub environment. Azure
binds that trust to GitHub's immutable owner and repository IDs as well as their display names, so
renaming or transferring a similarly named repository cannot inherit the credential.

The publish job requests `id-token: write`, signs in through `azure/login`, and invokes the stable
`vsce publish --azure-credential` flow for each platform-specific VSIX. GitHub stores the managed
identity's client, tenant, and subscription identifiers as repository variables; none is a secret.
The identity is a Contributor only to Marketplace publisher `divB0` and a Reader only within its
own Azure resource group.

Direct Visual Studio Marketplace trusted publishing was rejected for now. Although prerelease
`vsce` contains `--oidc`, the signed-in Marketplace publisher UI does not expose the policy control
required to authorize a repository and workflow. Shipping that path would leave releases unable to
authenticate.

## Security and cost boundaries

- No `VSCE_PAT`, client secret, certificate, password, or PAT fallback is stored.
- The GitHub environment gives the federated credential the immutable, repository-scoped subject
  `repo:divB0@3007954/gitvaulty@1330015085:environment:vscode-marketplace` for both tag pushes and
  exact-tag recovery runs.
- Azure grants the managed identity no write access to the subscription or resource group.
- Marketplace grants Contributor, not Owner, to the publishing identity.
- Managed identity and workload identity federation are free; no compute, storage, or networking
  resource is created.
- Package jobs remain read-only. Only the Marketplace publishing and identity-resolution jobs can
  request GitHub OIDC tokens.

## Bootstrap and release flow

A small manually dispatched identity-resolution workflow signs in as the managed identity and asks
the Visual Studio profile service for its Marketplace member ID. That non-secret identifier is
needed once to add the managed identity as a publisher Contributor and remains useful if the
publisher membership ever needs repair.

The existing release workflow continues to build and test five platform packages from an exact
`vX.Y.Z` tag. Once every package succeeds, it signs in through Entra and publishes all five VSIX
files. A rerun for `v3.0.1` is safe because the previous attempt stopped before uploading a package.
Later retries must still respect Marketplace's rule that a version cannot be published twice.

## Validation

Static workflow tests require the GitHub environment, job-scoped OIDC permission, `azure/login`
variables, stable `vsce`, all five artifacts, and `--azure-credential`, while rejecting PAT and
direct-Marketplace OIDC paths. Repository and extension suites validate the code. After provisioning,
run the identity resolver, add the returned profile as Contributor, then retry `v3.0.1` and verify
Marketplace reports the new version.
