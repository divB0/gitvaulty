# GitVaulty compared with Agebox

[Agebox](https://github.com/slok/agebox) and GitVaulty both encrypt complete files for storage in a
repository using age recipients. Agebox is a small GitOps-oriented encryption CLI; GitVaulty adds
repository-managed access control and guarded development workflows for teams and agents.

| Capability | GitVaulty | Agebox |
| --- | --- | --- |
| Encryption | Uses SOPS binary mode with native age identities. The committed `*.gitvaulty` file reveals none of the plaintext structure. | Uses age directly and supports age X25519 plus SSH RSA and Ed25519 keys. It is also format-agnostic. |
| Key management | Creates and manages one global native age identity by default, so each person backs up and manages a single key across all their GitVaulty repositories. A configured identity can isolate CI or sensitive repositories; compromise of the global key affects every repository that still authorizes it. | Does not create or manage private identities. It loads valid keys from `~/.ssh` by default or from a configured file or directory, so one existing key can span repositories while creation, backup, selection, and rotation remain external. |
| Team access | Maintains named users and groups in the repository. Each file has an exact group and direct-user policy, and membership changes automatically re-encrypt every affected file. | Loads recipients from a directory or command option. Its documentation does not describe named groups or a repository-managed per-file access policy; recipient changes require `agebox reencrypt`. |
| Git safety | Adds plaintext paths to the clone-local Git exclude file. Import detects tracked plaintext, warns about Git history, and can stop tracking the file while preserving the local copy. | Deliberately does not run Git commands or manage VCS state. `validate` can detect tracked files that are not encrypted, while ignore and index management remain the user's responsibility. |
| Streaming and pipes | `cat` streams the exact bytes of one authorized logical file without materializing it. It keeps diagnostics on stderr and refuses interactive-terminal output unless `--force` is explicit. | `cat` can decrypt one or more arbitrary encrypted files to stdout. Its documentation uses `--no-log` for clean output and does not describe an interactive-terminal guard. |
| Local and agent workflows | Provides guarded `edit`, `materialize`, `status`, `clean`, and `run` commands. `run` exposes only selected or identity-authorized files and removes only unchanged files it created. | Provides recursive and filtered `encrypt` and `decrypt`, plus `cat`, `validate`, `reencrypt`, and `untrack`. It does not document a temporary command or agent workflow. |
| IDE plugins | **Supported:** VS Code, through the official [GitVaulty extension](https://marketplace.visualstudio.com/items?itemName=divB0.gitvaulty), and JetBrains IDEs through the repository's native [GitVaulty plugin](../../jetbrains/README.md). Both edit decrypted documents without plaintext repository siblings. | **Supported:** none documented. Files are decrypted with the CLI before editing. |
| Distribution | Installs through npm and requires Node.js 20 or newer. | Ships as a single Go binary and as a container image. |

## Which one should I use?

Choose Agebox when you want a small, single-binary tool for bulk repository encryption, want to
reuse externally managed SSH keys across repositories, or prefer a tool that never changes Git
state for you.

Choose GitVaulty when the main problem is safely sharing `.env` files and other development secrets
among people and agents. Its first-class users, groups, per-file policies, automatic re-encryption,
single managed identity across repositories, safe plaintext migration, temporary command workflow,
and VS Code integration provide the access lifecycle around the encrypted files.

## Sources

Agebox's official README documents its [commands, stdout `cat` workflow, registry, recipient loading,
supported key types, private-key discovery, and no-VCS-side-effects design](https://github.com/slok/agebox). GitVaulty's Marketplace listing
documents its [VS Code extension](https://marketplace.visualstudio.com/items?itemName=divB0.gitvaulty).
This comparison was last verified on 2026-08-19.
