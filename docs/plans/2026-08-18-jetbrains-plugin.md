# JetBrains Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a production-oriented JetBrains plugin that edits existing GitVaulty files natively and saves only verified ciphertext.

**Architecture:** A Kotlin IntelliJ Platform plugin opens an in-memory logical virtual file and delegates authorization and encrypted reads/writes to a native editor runtime over framed standard I/O. CI builds and hashes one runtime pack per supported platform, then embeds the immutable runtime manifest in the plugin.

**Tech Stack:** Kotlin 2.3, IntelliJ Platform SDK 2025.2, IntelliJ Platform Gradle Plugin 2.18, Gradle 9.4, TypeScript 7, Node.js SEA, Vitest, JUnit 4, SOPS/age, GitHub Actions.

---

### Task 1: Add the editor runtime protocol

**Files:**
- Create: `editor-runtime/package.json`
- Create: `editor-runtime/package-lock.json`
- Create: `editor-runtime/src/protocol.ts`
- Create: `editor-runtime/src/bridge.ts`
- Create: `editor-runtime/test/protocol.test.ts`
- Create: `editor-runtime/test/bridge.test.ts`

**Steps:**

1. Write failing framing tests for partial/multiple frames, request IDs, maximum sizes, and malformed JSON.
2. Run `npm --prefix editor-runtime test` and confirm the missing implementation fails.
3. Implement four-byte big-endian framing and the `ping`, `open`, `save`, and `access` handlers.
4. Resolve and validate an encrypted source using the same canonical-path rules as the VS Code adapter; delegate reads and writes to the existing GitVaulty core.
5. Return stable conflict, invalid-text, GitVaulty, protocol, and internal error codes without logging request payloads.
6. Run runtime tests and typechecking.

### Task 2: Package native runtime assets

**Files:**
- Create: `editor-runtime/scripts/build-runtime.mjs`
- Create: `editor-runtime/scripts/create-manifest.mjs`
- Create: `editor-runtime/runtime-manifest.schema.json`
- Create: `editor-runtime/README.md`

**Steps:**

1. Add tests for platform mapping and deterministic manifest generation.
2. Bundle the bridge into one CommonJS file and inject it into the current Node executable using Node SEA and pinned `postject`.
3. Stage the matching SOPS executable and licenses, and produce a ZIP containing only the expected files.
4. Generate manifest assets with exact release URLs, byte sizes, SHA-256 digests, filenames, and protocol/runtime versions.
5. Build and smoke-test the native macOS ARM64 runtime locally with a framed `ping` request.

### Task 3: Scaffold and verify the JetBrains build

**Files:**
- Create: `jetbrains/settings.gradle.kts`
- Create: `jetbrains/build.gradle.kts`
- Create: `jetbrains/gradle.properties`
- Create: `jetbrains/gradlew`
- Create: `jetbrains/gradlew.bat`
- Create: `jetbrains/gradle/wrapper/*`
- Create: `jetbrains/src/main/resources/META-INF/plugin.xml`
- Create: `jetbrains/src/main/resources/gitvaulty-runtime-manifest.json`

**Steps:**

1. Create a Kotlin/JVM plugin project targeting IntelliJ Platform 2025.2 with the platform-only module dependency.
2. Configure manifest replacement through `-PgitvaultyRuntimeManifest`, plugin version `0.1.0`, Java 21, and tests.
3. Generate and commit the Gradle 9.4.1 wrapper.
4. Run `./jetbrains/gradlew -p jetbrains verifyPluginProjectConfiguration verifyPluginStructure` and fix all structural errors.

### Task 4: Implement runtime selection and communication

**Files:**
- Create: `jetbrains/src/main/kotlin/io/github/divb0/gitvaulty/runtime/Protocol.kt`
- Create: `jetbrains/src/main/kotlin/io/github/divb0/gitvaulty/runtime/RuntimeManifest.kt`
- Create: `jetbrains/src/main/kotlin/io/github/divb0/gitvaulty/runtime/RuntimeInstaller.kt`
- Create: `jetbrains/src/main/kotlin/io/github/divb0/gitvaulty/runtime/RuntimeClient.kt`
- Create: `jetbrains/src/test/kotlin/io/github/divb0/gitvaulty/runtime/*Test.kt`

**Steps:**

1. Write failing tests for framed I/O, platform mapping, manifest validation, checksum mismatch, unsafe ZIP entries, and error mapping.
2. Implement bounded framed JSON requests with serialized writes and matching response IDs.
3. Implement exact asset selection, size/hash verification, safe extraction, private permissions, and atomic cache promotion.
4. Support the explicit `GITVAULTY_EDITOR_RUNTIME` override for development/offline administration.
5. Run focused Kotlin tests.

### Task 5: Add native editor sessions and encrypted saves

**Files:**
- Create: `jetbrains/src/main/kotlin/io/github/divb0/gitvaulty/editor/GitVaultyFileEditorProvider.kt`
- Create: `jetbrains/src/main/kotlin/io/github/divb0/gitvaulty/editor/GitVaultyLauncherEditor.kt`
- Create: `jetbrains/src/main/kotlin/io/github/divb0/gitvaulty/editor/GitVaultyEditorService.kt`
- Create: `jetbrains/src/main/kotlin/io/github/divb0/gitvaulty/editor/GitVaultyEditorSession.kt`
- Create: `jetbrains/src/main/kotlin/io/github/divb0/gitvaulty/editor/GitVaultyVirtualFile.kt`
- Create: `jetbrains/src/test/kotlin/io/github/divb0/gitvaulty/editor/*Test.kt`

**Steps:**

1. Write failing tests for source acceptance, session reuse, logical filenames, successful save fingerprint updates, and failed/conflicting save behavior.
2. Register a launcher provider for local regular `*.gitvaulty` files and hide the raw default editor.
3. Open and authorize in a background task, then create a logical in-memory virtual file in the native editor.
4. Route virtual-file saves through the runtime and propagate failures as I/O errors so documents remain modified.
5. Serialize per-document saves and retain only source metadata/fingerprint outside JetBrains' document model.
6. Run editor tests and build the plugin.

### Task 6: Implement change handling and editor actions

**Files:**
- Create: `jetbrains/src/main/kotlin/io/github/divb0/gitvaulty/editor/GitVaultyNotifications.kt`
- Create: `jetbrains/src/main/kotlin/io/github/divb0/gitvaulty/editor/GitVaultyEditorNotificationProvider.kt`
- Create: `jetbrains/src/main/kotlin/io/github/divb0/gitvaulty/actions/*.kt`
- Modify: `jetbrains/src/main/resources/META-INF/plugin.xml`

**Steps:**

1. Add tests for dirty-source conflicts, clean reloads, deleted sources, explicit reload confirmation, export restrictions, and access display.
2. Subscribe to project VFS changes and reload only clean sessions; preserve dirty buffers and notify on conflict.
3. Add Show Access, Copy Logical Path, Copy Encrypted Path, Reload Encrypted Version, and Save Decrypted Copy Elsewhere actions.
4. Add an editor notice describing the native-editor security boundary and CLI fallback.
5. Verify that notifications and errors never include document contents or keys.

### Task 7: Add documentation and release automation

**Files:**
- Create: `jetbrains/README.md`
- Create: `jetbrains/CHANGELOG.md`
- Create: `.github/workflows/jetbrains-check.yml`
- Create: `.github/workflows/jetbrains-release.yml`
- Modify: `README.md`
- Modify: `package.json`

**Steps:**

1. Document installation, local development, supported IDEs, editor actions, runtime download, conflicts, and the native-editor security boundary.
2. Add root convenience scripts for runtime and JetBrains checks without changing existing command behavior.
3. Add CI checks for runtime tests and Gradle test/build/structure verification.
4. Add native runtime matrix packaging, manifest generation, plugin build, artifact upload, signing inputs, and gated Marketplace publishing.
5. Parse both workflow YAML files and inspect the plugin ZIP/runtime ZIP contents.

### Task 8: Final verification, commit, and integration

**Files:**
- Verify all changed files; modify only to correct verified defects.

**Steps:**

1. Run `npm ci && npm run check`.
2. Run `npm --prefix vscode ci && npm --prefix vscode run check`.
3. Run `npm --prefix editor-runtime ci && npm --prefix editor-runtime run check`.
4. Run `./jetbrains/gradlew -p jetbrains clean test buildPlugin verifyPluginProjectConfiguration verifyPluginStructure`.
5. Inspect Git status and generated archives for plaintext, keys, development fixtures, and unexpected files.
6. Commit the validated implementation.
7. Merge the worktree commit(s) into local `main` without including the pre-existing `package-lock.json` modification.
8. Delete the feature worktree and branch after confirming the merge.

