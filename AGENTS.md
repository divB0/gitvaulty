# Development

- Never break user space: preserve existing command names, arguments, options, defaults, and observable semantics. Follow [HOW_TO_VERSION.md](HOW_TO_VERSION.md).
- A breaking change requires a major version bump and explicit user approval before implementation.
- After validating changes, commit them.
- Before starting work, run `git fetch --all` and rebase the current `main` branch onto the latest `origin/main`. If local `main` has commits, base changes on top of local `main`.
- If the current working directory is dirty, create a worktree.

# Worktrees

- Create worktrees under the repository's `.worktrees/` directory.
- After completing changes in a worktree, merge its commit back into `main` from the main worktree, then delete the worktree.

# Planning

- For any non-trivial change, propose a plan and implementation details before starting implementation.

# Releases

- Classify and bump versions according to [HOW_TO_VERSION.md](HOW_TO_VERSION.md).
- Every GitHub release changelog must include a concise summary of the main user-facing changes. Do not publish a release with only a comparison link or raw commit list.
