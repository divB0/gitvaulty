# Parallel Demo Runtime Design

## Goal

Allow README demo generation to run concurrently from separate Git worktrees without one run
deleting another run's repository, identities, or local Git remote.

## Approach

Keep the existing host-based VHS workflow and replace its three fixed `/tmp` paths with one unique
runtime directory beneath `/tmp`, created atomically by `mktemp -d`. The generator wrapper owns that
directory and exports three paths beneath it for the working repository, runtime identities, and
bare Git remote.
VHS inherits those variables and uses them during its hidden setup. A wrapper-level `EXIT` trap
removes only the owning run's parent directory on success or failure.

This is preferable to UUID generation because `mktemp` creates and reserves the directory in one
operation. It is preferable to Docker for this requirement because parallel-path isolation does not
need a container image or daemon. The workflow remains a host process with the current user's
permissions; this change prevents run-to-run collisions but does not create a security sandbox.

## Data flow and failure handling

`npm run demo:generate` resolves the worktree root, allocates a runtime parent beneath `/tmp`,
exports the three child paths, builds the CLI, and starts VHS. Keeping the default under `/tmp`
prevents macOS's user-specific `${TMPDIR}` path from appearing in recorded Git output. The tape
creates and uses only those child paths. The GIF stays worktree-relative at
`demos/access-control.gif`, so separate worktrees also have separate outputs.

If prerequisite validation, the build, VHS, or output validation fails, the wrapper exits through
the same cleanup trap. Cleanup rejects no shared or unresolved target: it removes only the exact
directory returned by `mktemp` for that invocation.

## Verification

A regression test will run two instrumented copies of the wrapper at the same time with fake build
and VHS commands. It will verify distinct runtime roots, worktree-local GIF outputs, and cleanup of
both roots. Shell syntax, the complete project checks, a real demo generation, representative-frame
review, and final temporary-path checks complete verification. This internal tooling fix does not
change the shipped package, so it requires no package version bump.
