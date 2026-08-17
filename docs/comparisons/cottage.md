# GitVaulty compared with Cottage

[Cottage](https://github.com/sayanarijit/cottage) and GitVaulty both use age recipients to keep
complete secret files in a repository, support per-file access, and provide persistent and temporary
plaintext workflows. Cottage is a broad GitOps secret manager; GitVaulty focuses on a guarded,
centralized access model for development teams and agents.

| Capability | GitVaulty | Cottage |
| --- | --- | --- |
| Encryption and keys | Uses SOPS binary mode with native age identities. The committed `*.gitvaulty` file is opaque. | Uses age ciphertext directly and supports age and SSH keys. It stores a redacted metadata preview beside each encrypted file. |
| Team access | Stores named users, groups, and per-file policies in one repository registry. Adding or removing a group member automatically re-encrypts every affected file. | Stores recipient files in a directory tree and applies per-secret `allow` and `deny` rules with glob support. After recipient changes, the documented workflow runs `ctg sync` to re-encrypt secrets. |
| Plaintext safety | Import detects tracked plaintext and can remove it from Git's index while preserving it locally. Materialization rejects tracked, symlinked, mismatched, or unsafe destinations. `clean` removes only unchanged files. | Manages `.gitignore` and `.gitattributes`, offers verification and Git-hook integrations, and can remove plaintext with `--clean`. |
| Streaming and pipes | `cat` streams the exact bytes of one authorized logical file without materializing it. It keeps diagnostics on stderr and refuses interactive-terminal output unless `--force` is explicit. | Cottage has no direct stdout-decryption command. `ctg run` can invoke a tool such as `cat`, but it first decrypts the selected secret to a temporary repository file and deletes it after the child exits. |
| Commands and agents | `run` materializes only selected or identity-authorized files, scrubs private-key variables from the child environment, and removes only unchanged files created by that run. | `ctg run` temporarily decrypts files, `ctg env` injects values without writing them to disk, and documented Claude Code hooks clean secrets before an agent session and restore them afterward. |
| Visibility | Keeps ciphertext completely opaque. `status` reports whether local plaintext is current, missing, or modified; Git cannot provide meaningful content diffs. | Generates redacted previews and provides `ctg diff` for comparing local plaintext with ciphertext while keeping ordinary Git diffs reviewable. |
| IDE plugins | **Supported:** VS Code, through the official [GitVaulty extension](https://marketplace.visualstudio.com/items?itemName=divB0.gitvaulty). No dedicated JetBrains/IntelliJ plugin is documented. | **Supported:** none documented. Cottage provides `ctg edit` for CLI-driven editing. |
| Upstreams and distribution | Uses Git as the encrypted store, requires no hosting, and installs through npm. | Can use Git, `jj`, non-Git directories, configurable provider plugins, or Cottage Sync. It is distributed through Rust, Python, Node, and container channels. |

## Which one should I use?

Choose Cottage when you need environment injection, redacted previews and richer diffs, Git hooks,
SSH-key reuse, or synchronization with secret providers beyond Git.

Choose GitVaulty when you want a smaller Git-centered model with named team groups, automatic
re-encryption when group membership changes, conservative protection of locally modified plaintext,
access-scoped command execution for agents, and native VS Code editing.

## Sources

Cottage's official README and CLI source document its [encryption, access rules, temporary and
environment workflows, previews, hooks, agent integration, upstream providers, and command
surface](https://github.com/sayanarijit/cottage).
GitVaulty's Marketplace listing documents its
[VS Code extension](https://marketplace.visualstudio.com/items?itemName=divB0.gitvaulty). This
comparison was last verified on 2026-08-17.
