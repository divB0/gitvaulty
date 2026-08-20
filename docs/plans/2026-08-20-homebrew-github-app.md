# Immediate Homebrew Publication Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Dispatch, track, and verify the exact Homebrew formula update immediately after npm publication by using a repository-restricted, short-lived GitHub App token.

**Architecture:** The GitVaulty release workflow generates an installation token scoped to `divB0/homebrew-tap`, dispatches the tap updater with an exact version and unique request ID, locates that named run, and waits for its conclusion. The tap updater is dispatch-only, resolves the requested npm version, validates and tests changed formulae, and commits with its own repository `GITHUB_TOKEN`.

**Tech Stack:** GitHub Actions, `actions/create-github-app-token`, GitHub CLI, Node.js 24, Homebrew, Vitest, Node test runner.

---

### Task 1: Make the Homebrew updater version-specific and dispatch-only

**Files:**
- Modify: `/Users/andrea/repos/homebrew-tap/test/update-formula.test.mjs`
- Modify: `/Users/andrea/repos/homebrew-tap/test/update-workflow.test.mjs`
- Modify: `/Users/andrea/repos/homebrew-tap/scripts/update-formula.mjs`
- Modify: `/Users/andrea/repos/homebrew-tap/.github/workflows/update.yml`
- Modify: `/Users/andrea/repos/homebrew-tap/README.md`

**Step 1: Create an isolated tap worktree**

Run:

```sh
git -C /Users/andrea/repos/homebrew-tap fetch --all
git -C /Users/andrea/repos/homebrew-tap rebase origin/main
git -C /Users/andrea/repos/homebrew-tap check-ignore -q .worktrees
git -C /Users/andrea/repos/homebrew-tap worktree add .worktrees/homebrew-app-dispatch -b codex/homebrew-app-dispatch
```

Expected: clean worktree based on the latest tap `main`.

**Step 2: Write failing updater tests**

Add tests proving that the registry request uses an explicit `X.Y.Z` version, malformed versions are rejected, and the returned tarball checksum is derived from that version's archive. Inject a fake `fetch` function so the test performs no network request.

**Step 3: Write failing workflow tests**

Assert that `update.yml`:

- contains no `schedule` trigger;
- requires `workflow_dispatch.inputs.version` and `request_id`;
- uses both values in a unique `run-name`;
- invokes `node scripts/update-formula.mjs --version "${{ inputs.version }}"`; and
- preserves its isolated install/test and authenticated push steps.

**Step 4: Run tests to verify failure**

Run: `npm test`

Expected: failures for missing explicit-version support and the old scheduled workflow.

**Step 5: Implement exact-version metadata resolution**

Change `scripts/update-formula.mjs` to parse a required `--version X.Y.Z` argument, fetch
`https://registry.npmjs.org/gitvaulty/X.Y.Z`, download the returned tarball, compute SHA-256, and
feed the existing immutable-version checks. Export the request helper for deterministic unit tests.

**Step 6: Make the tap workflow event-driven**

Replace the schedule with required string inputs, add:

```yaml
run-name: Update GitVaulty ${{ inputs.version }} (request ${{ inputs.request_id }})
```

and pass the exact version to the updater. Update the README to state that GitVaulty's unified release dispatches the workflow immediately after npm publication.

**Step 7: Verify and commit the tap change**

Run:

```sh
npm test
git diff --check
```

Expected: all tap tests pass and no whitespace errors.

Commit only the five listed files with:

```sh
git add -- .github/workflows/update.yml README.md scripts/update-formula.mjs test/update-formula.test.mjs test/update-workflow.test.mjs
git commit -m "ci: make Homebrew updates release-driven"
```

### Task 2: Dispatch and monitor Homebrew from GitVaulty

**Files:**
- Modify: `.github/workflows/jetbrains-release.yml`
- Modify: `test/release-versioning.test.ts`
- Modify: `HOW_TO_VERSION.md`

**Step 1: Write the failing orchestration test**

Extend the release workflow model and assert that a `homebrew` job:

- depends on `npm`;
- uses pinned `actions/create-github-app-token@bcd2ba49218906704ab6c1aa796996da409d3eb1`;
- reads `vars.HOMEBREW_APP_CLIENT_ID` and `secrets.HOMEBREW_APP_PRIVATE_KEY`;
- restricts `owner` and `repositories` to `divB0/homebrew-tap`;
- requests only `permission-actions: write`;
- dispatches `update.yml` with exact `version` and `request_id` inputs; and
- finds the unique run and watches it with `--exit-status`.

**Step 2: Run the focused test to verify failure**

Run: `npx vitest run test/release-versioning.test.ts`

Expected: failure because the `homebrew` job does not exist.

**Step 3: Implement the Homebrew orchestration job**

Add a job after npm that creates the scoped installation token, dispatches the tap workflow, waits up to 60 seconds for its unique run title to appear through the Actions API, prints the tap run URL, and runs `gh run watch --exit-status`. Validate the release tag before deriving the version.

**Step 4: Document immediate publication**

Update `HOW_TO_VERSION.md` so it describes npm-success dispatch and tracked Homebrew validation. Remove the statement that the tap waits for a schedule.

**Step 5: Verify and commit the GitVaulty change**

Run:

```sh
npm test
npm run typecheck
git diff --check
```

Expected: 128 or more tests pass, type checking succeeds, and no whitespace errors occur.

Commit only the three listed files with:

```sh
git add -- .github/workflows/jetbrains-release.yml HOW_TO_VERSION.md test/release-versioning.test.ts
git commit -m "ci: publish Homebrew after npm"
```

### Task 3: Create and install the least-privilege GitHub App

**External state:**
- Create GitHub App: `gitvaulty-homebrew-publisher`
- Install only on: `divB0/gitvaulty`, `divB0/homebrew-tap`
- Repository permissions: `Actions: Read and write`, implicit metadata read
- Set GitVaulty repository variable: `HOMEBREW_APP_CLIENT_ID`
- Set GitVaulty Actions secret: `HOMEBREW_APP_PRIVATE_KEY`

**Step 1: Prepare the GitHub App form**

Use the signed-in GitHub session, disable webhooks, request only Actions write, and restrict repository installation to the two named repositories.

**Step 2: Ask for action-time confirmation**

Immediately before creating the App and persistent private key, confirm the exact permissions, installations, secret destination, and removal of the downloaded private-key copy.

**Step 3: Create and install the App**

Create the App, install it on the two selected repositories, generate one private key, and capture the non-secret Client ID.

**Step 4: Store credentials without printing them**

Run `gh variable set HOMEBREW_APP_CLIENT_ID --repo divB0/gitvaulty --body ...` and pipe the private-key file to `gh secret set HOMEBREW_APP_PRIVATE_KEY --repo divB0/gitvaulty`. Verify only the variable value and secret name/updated timestamp. Move the local downloaded key to Trash after successful storage.

### Task 4: Integrate, publish, and perform an idempotent end-to-end check

**Step 1: Rebase and merge each worktree commit into its repository main branch**

Follow each repository's worktree rules, inspect exact commits, merge into the corresponding local `main`, and delete the temporary worktrees.

**Step 2: Request explicit push authorization**

Report the exact GitVaulty and tap commits, branches, and tests. Push only after authorization.

**Step 3: Push both main branches**

Push `divB0/homebrew-tap` first so the dispatch contract exists, then push `divB0/gitvaulty`.

**Step 4: Verify repository CI**

Watch the tap test workflow and GitVaulty CI. If either fails, inspect failed logs and fix the root cause before continuing.

**Step 5: Run an idempotent cross-repository release check**

Dispatch the GitVaulty release workflow for the existing immutable `v3.0.1` tag with Marketplace publication disabled. Confirm npm rejects no duplicate publication by avoiding the full release retry; instead dispatch the Homebrew job's exact command path through a temporary/manual validation or the tap workflow with `version=3.0.1` and a unique request ID. Verify the tap run reports 3.0.1 already current and exits successfully.

**Step 6: Verify final state**

Confirm:

- the App is installed only on the two intended repositories;
- the GitVaulty variable and secret exist;
- no private key appears in git, logs, or local Downloads;
- the Homebrew schedule is absent;
- the 3.0.1 formula remains unchanged and validated; and
- both repositories are clean and synchronized with `origin/main`.
