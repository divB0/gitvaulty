# GitVaulty for JetBrains IDEs

The GitVaulty plugin opens an authorized local `*.gitvaulty` file in the IDE's normal text editor.
The document uses its logical plaintext filename for file-type detection, syntax highlighting, and
compatible language features. Saving delegates to GitVaulty's existing encryption and verification
logic, then atomically replaces the encrypted source. No plaintext sibling is created in the
repository.

## Requirements and supported platforms

- IntelliJ Platform build 252 or newer (the 2025.2 generation)
- A local GitVaulty repository and an age identity authorized for the file
- macOS Apple Silicon or Intel, Linux ARM64 or x64, or Windows x64

The plugin depends only on the IntelliJ Platform module, so the same package can load in desktop
JetBrains IDEs based on a compatible platform build.

## Install

Install [GitVaulty from JetBrains Marketplace](https://plugins.jetbrains.com/plugin/33659-gitvaulty/versions/stable?noRedirect=true),
or open **Settings | Plugins | Marketplace**, search for **GitVaulty**, and select **Install**.

For an offline release ZIP, open **Settings | Plugins**, select the gear menu, choose **Install Plugin
from Disk**, select `gitvaulty-jetbrains-<version>.zip`, and restart the IDE when prompted.

To build a development package:

```sh
./jetbrains/gradlew -p jetbrains buildPlugin
```

The ZIP is written under `jetbrains/build/distributions`. A development build needs either a release
runtime manifest embedded with `-PgitvaultyRuntimeManifest=/path/to/manifest.json`, or the
`GITVAULTY_EDITOR_RUNTIME` environment variable pointing at a locally built runtime executable.

## Edit an encrypted file

1. Open the local repository in the IDE.
2. Double-click a regular `*.gitvaulty` file in the Project view.
3. Edit the decrypted native document normally.
4. Save or use Auto Save to re-encrypt, verify, and atomically replace the ciphertext.

The first open downloads the runtime for the current operating system and architecture from the
exact GitHub Release URL embedded in the plugin. GitVaulty verifies the declared byte length and
SHA-256 digest before extracting it into the IDE system cache. The runtime bundle includes the
matching SOPS executable and license files.

If the current identity is not authorized, the editor remains closed and the IDE shows GitVaulty's
authorization error. Binary plaintext, invalid UTF-8, and NUL-containing text must be edited through
the CLI instead.

## Editor actions

Right-click inside an open GitVaulty editor and use the **GitVaulty** menu:

- **Show File Access** refreshes and displays the authorized users.
- **Copy Logical Path** copies the plaintext-relative path.
- **Copy Encrypted Path** copies the absolute `*.gitvaulty` path.
- **Reload Encrypted Version** discards the current buffer only after confirmation when it is dirty.
- **Save Decrypted Copy Elsewhere** writes a private `0600` copy on POSIX systems only to the path
  you explicitly select. It refuses symbolic links, the encrypted source, and destinations ending
  in `.gitvaulty`.

## External changes and conflicts

The plugin fingerprints ciphertext when it opens and after every successful save. If Git, another
editor, or another process changes the encrypted file, a clean editor reloads it. A dirty editor is
preserved and warns you to reload or export a decrypted copy. A later save still supplies the older
fingerprint, so GitVaulty refuses to overwrite newer ciphertext.

If encryption or verification fails, the encrypted source remains unchanged and the editor remains
dirty. The fingerprint advances only after a verified successful write.

## Security boundary

GitVaulty does not create a plaintext repository file or store plaintext in plugin settings, logs,
notifications, the runtime cache, or the runtime manifest. Plaintext does exist in the runtime
process and the IDE's in-memory document model. Compatible plugins, language services, or IDE crash
and recovery features may observe or persist that document. Use `gitvaulty edit` when this native
editor boundary is not acceptable.

The runtime communicates only over bounded, length-prefixed standard input and output. It never
opens a local network listener. Runtime downloads use immutable release URLs and must match the
embedded size and digest before execution.

## Development

Install the root and runtime dependencies, build the native runtime on the current platform, and
point the plugin tests at it:

```sh
npm ci
npm --prefix editor-runtime ci
node editor-runtime/scripts/build-runtime.mjs
./jetbrains/gradlew -p jetbrains test \
  -PgitvaultyTestRuntime="$PWD/editor-runtime/dist/<target>/gitvaulty-editor-runtime"
./jetbrains/gradlew -p jetbrains buildPlugin verifyPluginProjectConfiguration verifyPluginStructure
```

On Windows the executable name ends in `.exe`. `./jetbrains/gradlew -p jetbrains runIde` launches a
sandbox IDE for manual testing.

Release automation builds the runtime natively for all five targets, produces an exact manifest,
embeds it in the plugin, author-signs and verifies the plugin ZIP, and publishes a GitHub Release
with a real changelog summary. The signing certificate, encrypted private key, password, and
Marketplace token are committed only as `sre`-protected GitVaulty ciphertext under
`.github/jetbrains-release-secrets/`. GitHub Actions stores one bootstrap secret,
`GITVAULTY_KEY`, for the registered `github-ci` SRE member. The workflow exposes only the exact
release credentials required by each signing or publishing command and removes their temporary
plaintext files when the command exits.

The first plugin version was uploaded manually to establish its vendor, license, source repository,
tags, release channel, and listing details. Every later release must use a version that is not
already present on Marketplace. Update the version and release notes together in:

- `jetbrains/build.gradle.kts`
- `editor-runtime/package.json` and `editor-runtime/package-lock.json`
- `editor-runtime/scripts/package-tools.mjs`
- `editor-runtime/src/bridge.ts`
- `jetbrains/src/main/resources/gitvaulty-runtime-manifest.json`
- `jetbrains/src/main/resources/META-INF/plugin.xml` and `jetbrains/CHANGELOG.md`
- runtime tests that assert the current version

Commit and push those changes, then create and push the matching tag:

```sh
jetbrains_version=0.1.2
git tag -a "jetbrains-v${jetbrains_version}" -m "GitVaulty for JetBrains ${jetbrains_version}"
git push origin "jetbrains-v${jetbrains_version}"
```

The tag starts the **JetBrains plugin release** workflow. It builds and verifies all five runtimes,
signs the plugin, publishes the GitHub Release and its runtime assets, then uploads the same signed
version to the Stable channel on JetBrains Marketplace. No second workflow run is required.

If Marketplace publication fails before the version is accepted, retry the existing tag from
**Actions | JetBrains plugin release | Run workflow** with `publish_marketplace=true`. Do not retry
an update that Marketplace has already accepted; it rejects duplicate versions.
