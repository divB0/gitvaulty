# `gitvaulty key backup`

Save the private GitVaulty master identity to a password manager, the system clipboard, or standard
output.

## Usage

```sh
npx gitvaulty key backup
npx gitvaulty key backup --clipboard
npx gitvaulty key backup --print
```

GitVaulty first ensures an identity exists. If it is missing interactively, GitVaulty offers masked
restoration from a backup, creation of a new key, or cancellation.

With no flag, an interactive terminal asks:

```text
Where should GitVaulty save the backup?
> Password manager
  Clipboard
  Print to terminal
  Cancel
```

`--clipboard` and `--print` select a destination without prompting and work in non-interactive
environments. They cannot be combined. A flagless invocation without an interactive terminal fails
instead of choosing a destination implicitly.

## Password managers

The password-manager picker always lists the supported integrations:

```text
Choose a password manager
> 1Password  ✓ Detected
  Bitwarden  ○ CLI not found
  Back
```

GitVaulty detects the `op` and `bw` executables through `PATH`. An unavailable provider remains
selectable; choosing it shows official installation guidance and offers **Check again** or **Back**.
GitVaulty never installs software automatically.

1Password stores the identity in the concealed password field of a new **GitVaulty recovery key**
item. Its CLI must already be authenticated, either directly or through 1Password desktop-app
integration.

Bitwarden stores the identity as a new **GitVaulty recovery key** Secure Note. If the CLI is signed
out, GitVaulty asks you to run `bw login` and check again. If the vault is locked, GitVaulty runs the
masked interactive unlock flow, uses the resulting session only for the save, and locks that
temporary session afterward. Install the Bitwarden CLI with:

```sh
npm install --global @bitwarden/cli
```

The identity is sent to each provider through standard input. It is not placed in command
arguments, a shell command, a temporary file, or provider status output.

## Clipboard and printing

`--clipboard` copies only the raw `GITVAULTY-IDENTITY-...` value and reports success on standard
error. Desktop clipboard access is available on macOS, Windows, and supported Linux X11/Wayland
sessions. Headless and remote Linux sessions may not have a clipboard.

GitVaulty does not clear the clipboard automatically because a delayed clear can erase a newer
clipboard value and cannot remove copies kept by clipboard managers. Disable clipboard history and
cross-device clipboard synchronization when using this destination.

`--print` writes the raw identity plus one trailing newline to standard output. Printing is
deliberately explicit because terminal scrollback, logs, screen sharing, and redirected output can
retain the key. The interactive **Print to terminal** choice asks for a second confirmation.

## Security

Anyone with the identity can derive both private keys, decrypt authorized files, and sign policies
for groups where the identity is a manager. Store it in a password manager or another encrypted
backup. Do not paste it into chat, commit it, include it in shell history, or save it to an
unencrypted repository file.

The command does not require an initialized repository and does not modify the identity or
repository.

## Release note

GitVaulty 2.0.0 changes the flagless command from confirmed terminal printing to the interactive
destination picker. Automation that needs the raw value must use `--print`; automation targeting a
desktop clipboard can use `--clipboard`.

The major-release demo contract in `docs/demo/instructions.md` was reviewed. The recorded scenario
does not invoke `key backup`, so its tape, driver, and generated GIF remain current.

## Related commands

- [`gitvaulty key restore`](key-restore.md)
- [`gitvaulty key public`](key-public.md)
