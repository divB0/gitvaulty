# Native VS Code Editing for GitVaulty Files

## Goal

Let a user double-click any `*.gitvaulty` file in VS Code and edit its decrypted contents in a
native text editor. Saving must re-encrypt, verify, and atomically replace the ciphertext without
materializing plaintext in the repository or in a GitVaulty temporary directory.

## User experience

The GitVaulty extension registers as the default editor for `*.gitvaulty`. Opening
`.env.gitvaulty` briefly shows a decrypting state, then replaces that launcher with a native
virtual document named `.env`. Its plaintext suffix drives VS Code's normal language detection,
syntax highlighting, editing, undo, themes, formatting, and scheme-compatible language features.

The active editor displays a `$(lock) GitVaulty` status item. Save and Auto Save encrypt the current
bytes, verify that the ciphertext decrypts to the exact same bytes, and atomically replace the
original `*.gitvaulty` file. The encrypted file is the only repository file changed. Commands allow
the user to reload the encrypted version, copy the encrypted file path, and show effective access.

The first version supports UTF-8 text documents. Binary or invalid UTF-8 plaintext is rejected with
a message directing the user to the CLI or another binary-aware workflow. The extension is a
desktop/workspace extension because GitVaulty uses Node.js and the bundled SOPS executable.

## Architecture

The repository gains a separate `vscode/` extension package. It contributes a default custom editor
for `*.gitvaulty`; this custom editor is only a launcher. It resolves the source file, presents a
short decrypting state, opens a `gitvaulty:` URI in the same editor group, and disposes the launcher.

A writable `FileSystemProvider` owns the `gitvaulty:` scheme. Each URI retains a validated mapping
to its source ciphertext while its path ends with the logical plaintext filename. `readFile`
authorizes and decrypts through the GitVaulty core. `writeFile` performs a guarded encrypted write.
VS Code therefore supplies its standard text editor rather than a GitVaulty webview editor.

GitVaulty's public core API gains byte-oriented open and save operations:

- `readSecretFile(repo, plaintextPath)` returns the logical path, plaintext bytes, and a SHA-256
  fingerprint of the ciphertext that produced them.
- `writeSecretFile(repo, plaintextPath, bytes, expectedFingerprint)` checks authorization and the
  current ciphertext fingerprint, encrypts with the current recipient policy, verifies exact
  decryption, checks the fingerprint again immediately before replacement, atomically replaces the
  ciphertext, and returns its new fingerprint.
- A typed conflict error lets the extension distinguish concurrent modification from encryption,
  authorization, and filesystem failures.

The existing CLI edit and update flows reuse the guarded write primitive where appropriate so there
is only one verified encrypted replacement path.

## State and lifecycle

The provider maintains one session per canonical ciphertext URI. A session contains the virtual
URI, source URI, repository, logical path, ciphertext fingerprint, last observed metadata, and save
serialization promise. It never stores plaintext beyond buffers needed to serve a read or save.

VS Code file watchers monitor each source ciphertext. When a clean virtual document's ciphertext
changes, the provider emits a change event and VS Code reloads it. When the virtual document is
dirty, the extension preserves the editor buffer and warns the user. A later save compares the
stored fingerprint and fails on conflict. Save operations for the same document are serialized.

If encryption or verification fails, the provider reports the error and throws from `writeFile`, so
VS Code keeps the document dirty. Closing follows VS Code's normal Save, Don't Save, or Cancel flow.
Session mappings and watchers are disposed after the last corresponding text document closes. The
URI contains enough non-secret source information for the extension to reconstruct a session after
extension-host reload; it never embeds plaintext or key material.

Optimistic fingerprint checks detect changes before encryption and immediately before replacement.
An unrelated process that writes in the tiny interval between the final check and filesystem rename
cannot be made transactional without cooperation from that process; this is a documented filesystem
limit rather than a reason to silently accept an already-observed conflict.

## Errors and recovery

Missing identity, uninitialized repositories, denied access, invalid ciphertext, unsafe paths, and
invalid UTF-8 fail before the native editor opens. Messages explain the corrective action without
including decrypted content.

When ciphertext changes under a dirty editor, saving is refused. The notification offers:

- **Reload encrypted version**, which discards the dirty virtual buffer only after confirmation.
- **Save decrypted copy elsewhere**, which uses VS Code's Save dialog and writes only to the exact
  location chosen by the user.
- **Cancel**, which leaves the dirty editor untouched.

External changes to a clean editor reload automatically. Deleted or renamed ciphertext leaves an
open document readable but unsavable until the source is restored; the extension never recreates an
unregistered encrypted file implicitly.

## Security boundary

GitVaulty does not materialize plaintext in the repository, its temporary edit directories, or the
extension's own storage. Plaintext exists in the extension host, VS Code's text model, and any
compatible language tooling used by the editor.

Native editing also means VS Code may persist unsaved recovery data in its private Hot Exit or crash
recovery storage. Installed extensions and language servers may observe the virtual document. The
JavaScript runtime cannot guarantee erasure of immutable strings or copied buffers. Users requiring
strong isolation should continue using the CLI editor flow or a future isolated custom editor.

## Testing

Core tests cover byte-exact reads and writes, authorization, symlink/path protection, verified atomic
replacement, fingerprints, and conflicts before and during save. Existing CLI tests ensure the
refactor does not change command behavior.

Extension unit tests cover source/virtual URI mapping, UTF-8 validation, session reuse, serialized
saves, clean and dirty external changes, and conflict actions. VS Code extension-host tests open a
fixture `*.gitvaulty` file through its default editor, verify the resulting native virtual document's
language and contents, edit and save it, and confirm only verified ciphertext reaches the repository.
The final checks run root typechecking, tests, and build plus extension typechecking, tests, bundle,
and package validation.
