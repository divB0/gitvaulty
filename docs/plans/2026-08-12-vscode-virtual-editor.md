# VS Code Virtual Editor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make double-clicking a `*.gitvaulty` file in VS Code open an authorized native virtual text document whose saves safely update the verified ciphertext.

**Architecture:** Add guarded in-memory read/write primitives to the GitVaulty core, then build a separate desktop VS Code extension around a writable `gitvaulty:` filesystem. A default custom editor contribution acts only as an automatic launcher into the native virtual document; session state and ciphertext fingerprints provide external-change detection and save conflict handling.

**Tech Stack:** TypeScript 7, Node.js 20, VS Code Extension API, esbuild, Vitest, `@vscode/test-electron`, SOPS/age.

---

### Task 1: Add guarded core document reads and writes

**Files:**
- Modify: `src/errors.ts`
- Modify: `src/operations.ts`
- Modify: `src/index.ts`
- Modify: `test/operations.test.ts`

**Step 1: Write failing core tests**

Add tests that import a secret, call `readSecretFile`, and assert the exact plaintext and a stable
64-character ciphertext fingerprint. Add save tests proving `writeSecretFile` updates ciphertext,
returns a new fingerprint, preserves exact bytes, and updates an existing current materialization.
Add a test that modifies ciphertext after the read and expects a typed `SecretFileConflictError`
without overwriting the modified file.

**Step 2: Run the focused tests and verify failure**

Run: `npx vitest run test/operations.test.ts`

Expected: FAIL because the new exports and conflict error do not exist.

**Step 3: Implement the minimal guarded API**

Add:

```ts
export class SecretFileConflictError extends GitVaultyError {
  override name = "SecretFileConflictError";
  constructor(readonly file: string) {
    super(`Encrypted file changed while it was open: ${file}`);
  }
}

export interface OpenedSecretFile {
  file: string;
  encryptedFile: string;
  plaintext: Buffer;
  fingerprint: string;
}

export interface SavedSecretFile {
  file: string;
  encryptedFile: string;
  fingerprint: string;
}
```

Compute SHA-256 over raw ciphertext. Make the existing authorized-file resolver reusable, extend the
verified atomic replacement helper with an optional expected fingerprint, and check it before
encryption and immediately before rename. Export `readSecretFile`, `writeSecretFile`, their result
types, and `SecretFileConflictError` from `src/index.ts`. Keep the byte-oriented API binary-safe.

**Step 4: Run core tests and checks**

Run: `npx vitest run test/operations.test.ts && npm run typecheck`

Expected: PASS.

**Step 5: Commit**

```sh
git add src/errors.ts src/operations.ts src/index.ts test/operations.test.ts
git commit -m "feat: add guarded secret document API"
```

### Task 2: Scaffold the VS Code extension and URI/session model

**Files:**
- Create: `vscode/package.json`
- Create: `vscode/package-lock.json`
- Create: `vscode/tsconfig.json`
- Create: `vscode/esbuild.mjs`
- Create: `vscode/.vscodeignore`
- Create: `vscode/src/uri.ts`
- Create: `vscode/src/text.ts`
- Create: `vscode/src/session.ts`
- Create: `vscode/test/uri.test.ts`
- Create: `vscode/test/text.test.ts`
- Create: `vscode/test/session.test.ts`

**Step 1: Write failing unit tests**

Cover reversible mapping from local ciphertext URI to a `gitvaulty:` URI whose path ends in the
plaintext name, rejection of non-`*.gitvaulty` and unsupported source schemes, canonical session
reuse, valid UTF-8 decoding, and rejection of invalid UTF-8 or NUL-containing data.

**Step 2: Run tests and verify failure**

Run: `npm --prefix vscode test`

Expected: FAIL because the extension modules do not exist.

**Step 3: Add the package and minimal model**

Create a private extension package with `main: ./dist/extension.js`, desktop workspace extension
kind, VS Code engine compatibility, Vitest/esbuild scripts, VS Code types, and optional platform SOPS
packages needed by the bundled GitVaulty core. Implement URI validation/mapping, strict UTF-8 text
conversion, and a session registry keyed by canonical source URI. Do not store plaintext in session
objects.

**Step 4: Run unit tests and typechecking**

Run: `npm --prefix vscode test && npm --prefix vscode run typecheck`

Expected: PASS.

**Step 5: Commit**

```sh
git add vscode
git commit -m "feat: scaffold GitVaulty VS Code extension"
```

### Task 3: Implement the writable virtual filesystem

**Files:**
- Create: `vscode/src/filesystem.ts`
- Create: `vscode/src/core.ts`
- Create: `vscode/test/filesystem.test.ts`
- Modify: `vscode/src/session.ts`

**Step 1: Write failing provider tests**

Use an injected core adapter to test `stat`, `readFile`, and `writeFile`. Verify read authorization,
strict text validation, fingerprint updates, serialized overlapping saves, error propagation that
preserves dirty state, and `FileChangeType.Changed` notifications for clean external changes.

**Step 2: Run focused tests and verify failure**

Run: `npm --prefix vscode test -- filesystem.test.ts`

Expected: FAIL because the provider does not exist.

**Step 3: Implement the provider**

Wrap the new root core APIs behind an injectable adapter. Implement the writable methods VS Code's
text service requires and reject create, delete, rename, and directory mutation. Serialize writes
per session, translate GitVaulty errors to useful `FileSystemError` instances, update fingerprints
only after successful verified saves, and expose an event for conflicts and external changes.

**Step 4: Run extension tests and typechecking**

Run: `npm --prefix vscode test && npm --prefix vscode run typecheck`

Expected: PASS.

**Step 5: Commit**

```sh
git add vscode/src vscode/test
git commit -m "feat: add encrypted virtual filesystem"
```

### Task 4: Add automatic opening and editor UX

**Files:**
- Create: `vscode/src/extension.ts`
- Create: `vscode/src/launcher.ts`
- Create: `vscode/src/commands.ts`
- Create: `vscode/test/launcher.test.ts`
- Modify: `vscode/package.json`

**Step 1: Write failing launcher tests**

Test that resolving the contributed `*.gitvaulty` editor opens the mapped virtual document in the
same view column and disposes the launcher. Cover access/decryption failure, deduplicated opens,
status-bar visibility, source-path copy, reload, access display, and dirty conflict choices.

**Step 2: Run focused tests and verify failure**

Run: `npm --prefix vscode test -- launcher.test.ts`

Expected: FAIL because activation and launcher modules do not exist.

**Step 3: Implement activation and contributions**

Register the filesystem provider, default custom editor launcher, source watchers, close cleanup,
status bar, and commands. Contribute the `*.gitvaulty` selector with default priority. Show concise
notifications for missing identity, denied access, invalid ciphertext, invalid text, and conflicts.
Use VS Code's Save dialog only after the user explicitly chooses to export a decrypted copy.

**Step 4: Run extension checks**

Run: `npm --prefix vscode test && npm --prefix vscode run typecheck && npm --prefix vscode run build`

Expected: PASS and `vscode/dist/extension.js` exists.

**Step 5: Commit**

```sh
git add vscode
git commit -m "feat: open GitVaulty files natively in VS Code"
```

### Task 5: Add extension-host coverage and documentation

**Files:**
- Create: `vscode/src/test/runTest.ts`
- Create: `vscode/src/test/suite/index.ts`
- Create: `vscode/src/test/suite/editor.test.ts`
- Create: `vscode/README.md`
- Modify: `vscode/package.json`
- Modify: `README.md`

**Step 1: Write the extension-host test**

Create an initialized fixture repository and encrypted UTF-8 secret. Open the ciphertext using
`vscode.openWith`, assert the resulting active document uses the `gitvaulty` scheme and logical
filename, edit and save it, then decrypt the source and assert exact updated bytes. Assert no
plaintext repository file was created.

**Step 2: Run the host test and verify its initial failure**

Run: `npm --prefix vscode run test:integration`

Expected: FAIL until the test runner, activation timing, and package test configuration are wired.

**Step 3: Complete test wiring and docs**

Add the Electron test runner and extension test entry. Document installation from a VSIX, automatic
opening, Save and Auto Save behavior, status/commands, conflict recovery, UTF-8 scope, Hot Exit and
extension-observability limitations, and the CLI fallback. Add a concise VS Code section to the root
README.

**Step 4: Run all verification**

Run: `npm run check`

Run: `npm --prefix vscode run check`

Expected: both PASS, including unit tests, extension-host test, typechecking, and production bundle.

**Step 5: Inspect the package**

Run: `npm --prefix vscode run package`

Expected: a valid `.vsix` containing the extension bundle, README, license, and required platform
dependencies, with no source maps, tests, plaintext fixtures, keys, or unrelated repository files.

**Step 6: Commit**

```sh
git add README.md vscode
git commit -m "docs: explain native VS Code editing"
```

### Task 6: Final regression and integration

**Files:**
- Verify only; modify files only for defects found by the checks.

**Step 1: Run clean-install verification**

Run: `npm ci && npm run check`

Run: `npm --prefix vscode ci && npm --prefix vscode run check`

Expected: PASS from lockfiles.

**Step 2: Inspect repository state and commits**

Run: `git status --short && git log --oneline --decorate -8`

Expected: clean worktree with focused commits for the approved design, core API, extension model,
filesystem, UX, and documentation.

**Step 3: Merge and clean up the worktree**

From the main worktree, merge `codex/vscode-virtual-editor` into local `main`, preserving unrelated
working-tree changes. Re-run the focused checks from main, then remove
`.worktrees/vscode-virtual-editor` and delete the feature branch.
