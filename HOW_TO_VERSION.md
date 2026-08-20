# How to Version GitVaulty

GitVaulty follows semantic versioning: `MAJOR.MINOR.PATCH`.

## Protect User Space

Never break existing user space in a minor or patch release. User space includes every documented or observable part of the command-line interface, including:

- command and subcommand names;
- positional arguments, options, and accepted values;
- defaults and configuration behavior;
- command semantics and side effects;
- output formats that users or scripts may consume; and
- exit codes and error behavior.

Preserve these contracts unless the user explicitly approves a breaking change. Before implementing a breaking change:

1. Explain what will break and why the change is necessary.
2. Ask the user for explicit approval.
3. Plan a major version bump for the release containing the change.

Do not implement the breaking change until approval is received.

## Choose the Version Bump

### Major

Bump the major version for any approved user-space breaking change, such as:

- removing or renaming a command, argument, or option;
- changing an existing argument's meaning or accepted syntax;
- changing defaults or behavior in a way that can alter existing workflows;
- changing script-consumable output or exit behavior incompatibly; or
- requiring users to rewrite existing commands or automation.

A major bump does not replace the approval requirement. Both are mandatory.

### Minor

Bump the minor version for new backward-compatible functionality, including adding a new command, argument, or option. Existing commands and workflows must continue to behave as before.

### Patch

Bump the patch version for backward-compatible fixes. A fix may correct behavior that is clearly defective, but it must not silently redefine an established user-space contract. If a proposed fix would break existing commands or their semantics, treat it as a breaking change instead.

Documentation, tests, and internal refactors that do not change the shipped package do not require a package version bump on their own.

## Decision Order

When classifying a change, use this order:

1. Does it break any existing user-space contract? Ask for approval and bump major.
2. Does it add backward-compatible functionality? Bump minor.
3. Does it only fix existing behavior compatibly? Bump patch.
4. Does it only change documentation, tests, or internals without affecting the shipped package? No package bump is required.

When uncertain whether users may rely on a behavior, treat it as user space and ask before changing it.

## Prepare One Version for Every Distribution

The root `package.json` version is authoritative for the npm package, VS Code extension, native
editor runtime, and JetBrains plugin. Every release rebuilds all three public distributions because
both editor integrations bundle GitVaulty's core implementation.

Before bumping the version:

1. Add a concise `## X.Y.Z` user-facing summary to `CHANGELOG.md`.
2. Update `vscode/CHANGELOG.md` for extension-visible changes.
3. Update `jetbrains/CHANGELOG.md` and the `<change-notes>` in
   `jetbrains/src/main/resources/META-INF/plugin.xml` for plugin-visible changes.
4. For a minor or major release, review the demo contract as described in the repository release
   instructions and update the generated demo when required.
5. Commit those release notes and all implementation changes.

Then create the version commit and annotated `vX.Y.Z` tag with npm. The npm `version` lifecycle
synchronizes and stages the editor metadata automatically:

```sh
npm version patch
npm run versions:check
git push origin main --follow-tags
```

Use `minor` or `major` instead of `patch` according to the classification above. Do not create
`vscode-v*` or `jetbrains-v*` tags. The single `vX.Y.Z` tag builds the VS Code packages, all five
JetBrains runtimes and the signed plugin, publishes the shared GitHub Release, uploads both editor
integrations to their stable Marketplace channels, and triggers npm publication. After npm succeeds,
the same release dispatches the exact version to the Homebrew tap with a short-lived, repository-scoped
GitHub App token and waits for the tap's validation workflow to succeed.

VS Code Marketplace publication uses Microsoft Entra workload identity federation. GitHub OIDC
signs into the `gitvaulty-vscode-publisher` managed identity only from the `vscode-marketplace`
environment, then stable `vsce --azure-credential` publishes as a Contributor to Marketplace
publisher `divB0`. GitHub stores only the public client, tenant, and subscription identifiers as
repository variables. The workflow does not use or fall back to a `VSCE_PAT` repository secret.

Manual workflow dispatch is recovery-only. Supply the existing `vX.Y.Z` tag so every retry checks
out and republishes the exact tagged source rather than the current `main` branch.

## Verify Distribution Channels

After publishing a GitVaulty release, verify that the matching version is available from npm, the
[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=divB0.gitvaulty), and the
[JetBrains Marketplace](https://plugins.jetbrains.com/plugin/33659-gitvaulty/versions/stable?noRedirect=true).
The
public [`divB0/homebrew-tap`](https://github.com/divB0/homebrew-tap) repository receives the exact
published npm version from the unified release, updates its pinned tarball URL and SHA-256, validates
the formula, and reports its result back to the release workflow. Confirm that the tap formula reaches
the same version before announcing Homebrew availability for the release.
