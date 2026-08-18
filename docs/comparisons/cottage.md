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
| Commands and agents | `run` materializes only selected or identity-authorized files, scrubs private-key variables from the child environment, and removes only unchanged files created by that run. A repository-scoped skill teaches compatible agents to request only required files and avoid exposing secret values. | `ctg run` temporarily decrypts files and `ctg env` injects values without writing them to disk. Cottage documents safety hooks or rules for Claude Code, GitHub Copilot, Codex, Antigravity, and Cursor; plugins are available for Claude Code, Codex, and Antigravity. These integrations clean plaintext and block agents from invoking Cottage or accessing protected paths. |
| Visibility | Keeps ciphertext completely opaque. `status` reports local plaintext state, while `diff` decrypts in memory and prints Git-style plaintext changes relative to the encrypted source. | Generates redacted previews and provides `ctg diff` for comparing local plaintext with ciphertext while keeping ordinary Git diffs reviewable. |
| IDE plugins | **Supported:** VS Code, through the official [GitVaulty extension](https://marketplace.visualstudio.com/items?itemName=divB0.gitvaulty). It edits decrypted virtual documents without creating plaintext siblings in the repository. No dedicated JetBrains/IntelliJ plugin is documented. | **Supported:** VS Code, through the official [Cottage extension](https://marketplace.visualstudio.com/items?itemName=sayanarijit.vscode-plugin-cottage). It installs Cottage, configures Copilot and Claude safety hooks, encrypts Explorer files, and edits `.cott.age` files through temporary plaintext siblings that it re-encrypts on save and cleans when the editor loses focus or closes. No dedicated JetBrains/IntelliJ plugin is documented. |
| Upstreams and distribution | Uses Git as the encrypted store, requires no hosting, and installs through npm. | Can use Git, `jj`, non-Git directories, configurable provider plugins, or Cottage Sync. It is distributed through Rust, Python, Node, and container channels. |

## Which one should I use?

Choose Cottage when you need environment injection, committed redacted previews, Git hooks, broad
coding-agent integrations, SSH-key reuse, or synchronization with secret providers beyond Git.

Choose GitVaulty when you want a smaller Git-centered model focused on team access: named users and
reusable groups, centralized per-file policies, automatic re-encryption when group membership
changes, completely opaque ciphertext, guarded stdout streaming, conservative protection of locally
modified plaintext, and VS Code editing that does not create a plaintext repository file.

## Sources

Cottage's official README and CLI source document its [encryption, access rules, temporary and
environment workflows, previews, hooks, agent integrations, upstream providers, and command
surface](https://github.com/sayanarijit/cottage). Its [VS Code extension repository](https://github.com/sayanarijit/vscode-plugin-cottage)
and [Marketplace listing](https://marketplace.visualstudio.com/items?itemName=sayanarijit.vscode-plugin-cottage)
document its editor workflow and generated agent-safety hooks.
GitVaulty's Marketplace listing documents its
[VS Code extension](https://marketplace.visualstudio.com/items?itemName=divB0.gitvaulty). This
comparison was last verified on 2026-08-18.
