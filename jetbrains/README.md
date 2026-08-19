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

For a release ZIP, open **Settings | Plugins**, select the gear menu, choose **Install Plugin from
Disk**, select `gitvaulty-jetbrains-<version>.zip`, and restart the IDE when prompted.

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
embeds it in the plugin, author-signs and verifies the plugin ZIP, and creates a GitHub Release draft
with a real changelog summary. The release workflow requires these GitHub Actions secrets:

- `JETBRAINS_CERTIFICATE_CHAIN`
- `JETBRAINS_PRIVATE_KEY`
- `JETBRAINS_PRIVATE_KEY_PASSWORD`
- `JETBRAINS_PUBLISH_TOKEN` for Marketplace updates

JetBrains requires the first plugin version to be uploaded manually so its vendor, license, source
repository, tags, release channel, and listing details can be selected. Create and push the
`jetbrains-v0.1.0` tag, publish the resulting GitHub Release draft so its runtime assets are public,
then upload `gitvaulty-jetbrains-0.1.0-signed.zip` in JetBrains Marketplace. For later versions, run
the **JetBrains plugin release** workflow manually with `publish_marketplace=true` after publishing
the matching GitHub runtime release.
