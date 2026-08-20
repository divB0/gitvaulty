# Immediate Homebrew Publication with a GitHub App

## Goal

Publish the matching Homebrew formula immediately after a GitVaulty npm release succeeds, without
polling or a long-lived personal access token.

## Architecture

The GitVaulty release workflow remains the release orchestrator. After its reusable npm publication
job succeeds, a new Homebrew job creates a short-lived installation token for a dedicated GitHub
App. The App is installed only on `divB0/gitvaulty` and `divB0/homebrew-tap`; the generated token is
further restricted to `homebrew-tap` and receives only the App's `Actions: write` permission.

The Homebrew job dispatches `homebrew-tap/.github/workflows/update.yml` with the exact released
version and the originating GitHub Actions run ID. The tap workflow uses these inputs in its run
name, allowing the GitVaulty workflow to locate the resulting run without ambiguity and wait for
its conclusion. A failed dispatch, update, formula installation, test, or push therefore fails the
originating GitVaulty release workflow.

The tap workflow continues to use its own repository-scoped `GITHUB_TOKEN` with `contents: write`
to commit the formula. The GitHub App token can start and observe Actions runs but cannot modify tap
contents directly.

## Credentials and Permissions

- GitHub App repository access: only `gitvaulty` and `homebrew-tap`.
- GitHub App repository permissions: `Actions: write`; implicit `Metadata: read`.
- GitVaulty repository variable: `HOMEBREW_APP_ID`.
- GitVaulty Actions secret: `HOMEBREW_APP_PRIVATE_KEY`.
- Installation tokens: generated during the release job, scoped to `homebrew-tap`, and short-lived.

The private key is never committed or printed. GitHub stores it as an encrypted Actions secret.

## Homebrew Workflow

The six-hour schedule is removed. `workflow_dispatch` requires `version` and `request_id` inputs.
The updater resolves the requested npm package version rather than an unqualified latest version,
updates the tarball URL and SHA-256, verifies Ruby syntax and Homebrew style, installs the formula
from source, runs its test, and commits `gitvaulty <version>` to `main`.

The existing independent formula test workflow remains available for repository pushes and manual
validation, but it is not a release trigger or fallback updater.

## Failure and Recovery

The release job waits briefly for the dispatched run to appear, then watches it through completion.
If it cannot find the matching request ID or the tap run fails, the release reports failure with the
tap run URL when available. Recovery uses the existing release workflow's manual dispatch for the
same immutable `vX.Y.Z` tag; the Homebrew updater is idempotent when the formula already matches.

## Verification

Repository tests will assert the App token scope, npm-to-Homebrew dependency, exact dispatch inputs,
run tracking, and absence of a Homebrew schedule. End-to-end verification will dispatch the updater
for the already-published 3.0.1 version, confirm an idempotent successful run, and confirm the
GitVaulty release workflow can authenticate with the App without exposing its private key.
