# Homebrew Tap Design

GitVaulty will use a public `divB0/homebrew-tap` repository so macOS and Linux users can install the
CLI with `brew install divB0/tap/gitvaulty`. Homebrew is the recommended macOS installation path;
npm remains the canonical cross-platform package and the source used by the formula.

The formula will pin the published npm tarball by version and SHA-256, depend on Homebrew's shared
Node runtime, and install the package with Homebrew's standard `std_npm_args` helper. GitVaulty's
existing platform-specific optional dependency continues to supply the tested SOPS version. This
avoids embedding a second Node runtime while preserving the CLI's current behavior and SOPS pin.
The formula test will run `gitvaulty --version` and a harmless help command.

The tap will update itself rather than requiring a cross-repository write token in GitVaulty's
release workflow. A scheduled and manually runnable GitHub Actions workflow will compare the npm
registry's latest GitVaulty version with the formula, download the exact tarball, calculate its
SHA-256, update the formula, validate it, and commit the change with the tap repository's own
`GITHUB_TOKEN`. A separate workflow will validate formula changes on macOS and Linux.

The initial formula targets the latest version already published to npm. The unreleased version in
the GitVaulty repository is not published as part of creating the tap; once a normal GitVaulty
release publishes it to npm, the tap updater will adopt it automatically. GitVaulty's README will
put Homebrew first for macOS and retain npm/npx instructions for other platforms and CI.

