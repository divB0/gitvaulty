# Edit GitVaulty files in VS Code

The [GitVaulty extension](https://marketplace.visualstudio.com/items?itemName=divB0.gitvaulty)
opens an encrypted `*.gitvaulty` file as a normal editable text document. Saving the document
re-encrypts it and updates only the ciphertext in the repository.

## Install the extension

In VS Code, open **Extensions**, search for **GitVaulty**, and select **Install**. You can also install
it from a terminal:

```sh
code --install-extension divb0.gitvaulty
```

Native packages are available for macOS (Apple Silicon and Intel), Linux (ARM64 and x64), and
Windows x64. The extension requires VS Code 1.100 or newer.

## Prepare the repository

Open a local Git repository that has already been initialized with GitVaulty:

```sh
npx gitvaulty init
```

If you are joining an existing repository, restore your private age identity or register a new
identity's public recipient without access:

```sh
npx gitvaulty key restore
# Or register a new identity on your branch:
npx gitvaulty user register alice
```

Commit `.gitvaulty/recipients.json` for review. An existing authorized developer can then run
`npx gitvaulty group add team alice`, commit the updated registry and ciphertext, and merge the
access grant. Private age keys must never be shared.

GitVaulty decrypts repository secrets, so VS Code must trust the workspace. The extension works with
local folders and does not support virtual workspaces.

## Open and edit a file

1. Open the repository folder in VS Code.
2. In the Explorer, select a file such as `.env.gitvaulty`.
3. GitVaulty decrypts it into a virtual document named `.env`, preserving normal syntax
   highlighting, formatting, completion, themes, undo, and keyboard shortcuts.
4. Edit the document normally.
5. Save it with **File → Save**, the usual keyboard shortcut, or Auto Save.

On save, GitVaulty encrypts the updated bytes with the file's existing access policy, decrypts the
result to verify an exact match, and atomically replaces the encrypted file. It does not create a
plaintext `.env` file in the repository.

The extension edits existing encrypted files. Use the CLI to create or import one first:

```sh
npx gitvaulty create config/secrets.yaml
npx gitvaulty import .env
```

## Editor commands

Open the Command Palette while a decrypted GitVaulty document is active:

- **GitVaulty: Show File Access** lists the users who can decrypt the file.
- **GitVaulty: Copy Encrypted File Path** copies the underlying `*.gitvaulty` path.
- **GitVaulty: Reload Encrypted Version** discards the editor buffer and decrypts the current
  ciphertext again.

The `$(lock) GitVaulty` status-bar item confirms that the active document is a decrypted virtual
document. Select it to show file access.

## Concurrent changes

The extension fingerprints the encrypted file when it opens. If Git, another editor, or another
process changes that file, GitVaulty will not overwrite the newer ciphertext:

- A clean virtual document reloads automatically.
- A document with unsaved edits offers to reload the encrypted version or save the decrypted buffer
  to a location you choose.

After resolving the other change, reopen or reload the encrypted file before editing it again.

## Security boundary

GitVaulty does not write plaintext into the repository, a GitVaulty temporary directory, or the
extension's own storage. Native editing does place decrypted text in VS Code's document model.
Other installed extensions and language servers may observe it, and VS Code may persist unsaved
Hot Exit or crash-recovery data in its private application storage.

Use the more isolated CLI editor when that boundary is not appropriate:

```sh
npx gitvaulty edit .env
```

The VS Code editor accepts valid UTF-8 text without NUL bytes. Use the CLI workflow for binary files.

## Troubleshooting

### The file does not decrypt

Confirm that the folder is a local, trusted VS Code workspace; the repository contains
`.gitvaulty/recipients.json`; and your current identity has access:

```sh
npx gitvaulty key public
npx gitvaulty user list
```

If this machine does not have your identity, restore its private backup with
`npx gitvaulty key restore`. If your public recipient is absent from the repository, ask an existing
member to review a `npx gitvaulty user register <username>` commit and grant the appropriate group.

### The encrypted file changed while editing

Do not force the save. Choose **Reload encrypted version** to accept the newer ciphertext, or
**Save decrypted copy elsewhere** to preserve your unsaved text. Reconcile the changes and then
reopen the `*.gitvaulty` file.

### The file is binary or invalid UTF-8

The native VS Code editor is text-only. Edit the logical plaintext path through the CLI instead:

```sh
npx gitvaulty edit path/to/file
```
