# Native JetBrains Editing for GitVaulty Files

## Goal

Provide one GitVaulty plugin for the desktop JetBrains IDE family. An authorized developer can open
an existing `*.gitvaulty` file in the native text editor, use the logical plaintext filename for
language detection, and save verified ciphertext without creating a plaintext sibling in the
repository.

The first release supports local projects and UTF-8 text editing. It does not create or import
files, change access, manage users or groups, edit binary data, or support JetBrains Gateway and
remote development. Those workflows remain available through the GitVaulty CLI.

## Architecture

The implementation has three layers:

1. A Kotlin plugin in `jetbrains/` owns JetBrains file-editor integration, virtual documents,
   notifications, actions, runtime installation, and lifecycle management.
2. A small GitVaulty editor runtime in `editor-runtime/` exposes the existing TypeScript core over
   a versioned, length-prefixed JSON protocol on standard input/output.
3. Release automation builds a native runtime pack for macOS ARM64/x64, Linux ARM64/x64, and
   Windows x64, generates a manifest containing exact immutable URLs, byte sizes, and SHA-256
   digests, then embeds that manifest in the plugin build.

Kotlin is not a second cryptographic implementation. The runtime continues to use the same
repository discovery, identity resolution, access policy, SOPS invocation, ciphertext
fingerprinting, verified encryption, and atomic replacement code as the CLI and VS Code extension.

The plugin declares only `com.intellij.modules.platform`, which JetBrains documents as available in
all standalone IntelliJ Platform products. The build uses the current IntelliJ Platform Gradle
Plugin 2.x and its plugin-structure and compatibility verification tasks.

## Editor flow

A `FileEditorProvider` claims local regular files ending in `.gitvaulty` and hides the raw default
editor. Its lightweight launcher starts an authorized open request in the background. On success,
the plugin creates an in-memory virtual file named after the logical plaintext path and opens it
through the native JetBrains text editor. The encrypted source remains the only project file.

The virtual file stores a source mapping and ciphertext fingerprint, but no extra plaintext copy.
JetBrains' document model owns the editable text. On save, the virtual file sends the current UTF-8
bytes and expected fingerprint to the runtime. The runtime rejects stale content, encrypts using
the current access policy, verifies byte-exact decryption, checks the fingerprint immediately
before replacement, and returns the new fingerprint. Save failures propagate as I/O errors so the
document remains modified.

Source VFS events trigger a background reload for a clean document. If the document is dirty, its
buffer is preserved and the plugin reports a conflict. A subsequent save also refuses to overwrite
changed ciphertext. If the source is deleted or renamed, the open buffer remains readable but
cannot be saved.

## Runtime protocol and installation

Each frame is a four-byte big-endian length followed by UTF-8 JSON. Requests contain an ID, protocol
version, method, and method-specific parameters. Responses repeat the ID and contain either a
result or a stable error code. Plaintext is base64 encoded inside the framed stream and never
appears in command-line arguments, log messages, temporary files, or protocol diagnostics.

Supported methods are `ping`, `open`, `save`, and `access`. `open` returns the logical path,
validated UTF-8 bytes, fingerprint, and effective users. `save` requires the source path,
fingerprint, and complete document bytes. Frames and decoded documents have explicit size limits.

For normal installations, the plugin selects one asset from its embedded manifest, downloads it to
a private JetBrains system-cache directory, verifies size and SHA-256 before extraction, rejects
unexpected or unsafe ZIP entries, applies private/executable permissions, and atomically promotes
the completed directory. It never resolves a mutable `latest` URL or updates the runtime separately
from the plugin. `GITVAULTY_EDITOR_RUNTIME` is an explicit development and administrator override
for a preinstalled executable.

## UX, errors, and recovery

The editor displays a GitVaulty notice explaining that content is decrypted in the IDE and
encrypted on save. Available actions show effective access, copy logical or encrypted paths, reload
the encrypted version, and explicitly export a decrypted copy. Export refuses the encrypted source
and `*.gitvaulty` destinations.

Missing identities, uninitialized repositories, denied access, invalid ciphertext, unsafe paths,
invalid UTF-8/NUL content, runtime verification errors, source deletion, and conflicts are reported
without including plaintext or key material. Reload asks before discarding dirty edits. Closing
uses the platform's ordinary save/discard/cancel behavior.

## Security boundary

GitVaulty does not materialize plaintext in the repository, plugin cache, runtime cache, command
arguments, or logs. Plaintext does exist in the runtime process, Kotlin/Java objects, JetBrains'
document model, compatible language services, and potentially IDE recovery storage. Other installed
plugins can observe native editor content. The plugin discloses this boundary; users needing a
smaller observation surface should use `gitvaulty edit`.

## Testing and release

Runtime tests cover framing, request IDs, size limits, invalid methods, UTF-8 validation, exact
open/save behavior, and conflict responses. Kotlin tests cover framing, manifest validation,
platform selection, checksum/extraction rules, source acceptance, virtual-file saves, error
mapping, and session reuse. Gradle builds the plugin archive and runs plugin structure and project
configuration verification.

The release workflow builds runtimes on their native GitHub-hosted operating systems, packages the
matching SOPS executable, generates the immutable manifest, builds the plugin with that manifest,
and uploads all artifacts to a draft/tagged GitHub Release. Marketplace publishing remains gated by
the repository's signing certificate and JetBrains publish token.

