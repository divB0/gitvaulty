<p align="center">
  <img src="https://raw.githubusercontent.com/divB0/gitvaulty/main/assets/gitvaulty-logo.png" alt="GitVaulty logo" width="180" />
</p>

<h1 align="center">gitvaulty</h1>

<p align="center">
  <strong>Git-backed secret access control for teams and agents.</strong>
</p>

<p align="center">
  Open source. No hosting required.
</p>

GitVaulty encrypts complete files with SOPS and age so they can live safely in Git. Filenames,
contents, comments, formatting, and file types are preserved when decrypted; the committed
`*.gitvaulty` file reveals none of the plaintext structure.

Access is assigned to groups per file, with direct user grants available for exceptions. Every
person keeps their own private age identity; there is no shared team decryption key.

GitVaulty is available on [npm](https://www.npmjs.com/package/gitvaulty) and requires Node.js 20 or
newer.

## Quick start

Initialize GitVaulty in a Git repository:

```sh
npx gitvaulty init
```

Initialization creates a `team` group containing you. New and imported files use `team` by default,
so the normal workflow needs no access flags.

### Migrate an existing file

If `.env` already exists, import it:

```sh
npx gitvaulty import .env
```

GitVaulty creates `.env.gitvaulty`, decrypts it again to verify an exact byte-for-byte match, and
keeps the original `.env` available locally. It also adds `.env` to the clone-local Git exclude
file. Commit `.env.gitvaulty`, not `.env`.

If the plaintext file is tracked, GitVaulty warns that its secrets may already exist in Git history
and asks before continuing:

```text
.env is tracked by Git and may already exist in Git history.
Rotate any exposed credentials even if you continue.
? Stop tracking .env and continue importing? (y/N)
```

Accepting preserves the local plaintext file, adds it to the clone-local Git exclude file, and
removes it from Git's index with `git rm --cached`. If the file was already committed, its deletion
is staged alongside the new encrypted file. Declining makes no import or index changes.

This does not erase the plaintext from existing commits or other clones. Rewriting shared Git
history is a separate, disruptive repository operation; rotate every credential that may have been
exposed regardless of whether you later rewrite that history.

### Create a new file

If the plaintext file does not exist:

```sh
npx gitvaulty create config/secrets.yaml
```

GitVaulty creates `config/secrets.yaml.gitvaulty` and opens a temporary plaintext copy in
`$VISUAL`, `$EDITOR`, or the platform's default editor. Save an ordinary file—there are no special
markers and no values to label as secrets. The entire file is encrypted when the editor closes.

`create` never imports an existing file. Use `import` explicitly for migration.

Choose a narrower group while creating or importing when needed:

```sh
npx gitvaulty create .env.production --group production
npx gitvaulty import service-account.json --group platform --user alice
```

`--group` and `--user` may be repeated. Direct users are intended for exceptions; groups are the
primary access model.

## Edit

Always use the logical plaintext path:

```sh
npx gitvaulty edit .env
npx gitvaulty edit config/secrets.yaml
```

GitVaulty decrypts the file into a private temporary directory, opens the normal filename for
editor syntax highlighting, encrypts changed bytes atomically, and removes the temporary directory.
The directory is created below the operating system's standard temporary location (for example,
`/tmp` on many Linux systems or `%TEMP%` on Windows) with a name such as
`gitvaulty-edit-Ab12Cd`.

While the editor is open, GitVaulty holds a process-owned localhost lock for that directory. On a
normal exit, the plaintext directory is removed immediately. A crash, power loss, or `SIGKILL` can
prevent that immediate removal, so every later GitVaulty command also checks for abandoned edit
directories. An unlocked directory must be at least five minutes old before it is removed; a
responding lock always wins and never expires merely because the edit has been open for a long
time.

Startup cleanup is deliberately conservative. It considers only exact `gitvaulty-edit-*` direct
children owned by the current user, with private directory and lock-file permissions and valid lock
metadata. Symlinks, malformed locks, unusual permissions, and unrelated temporary files are left
untouched. Cleanup failures never prevent the requested GitVaulty command from running.

If a matching plaintext file is already materialized, GitVaulty updates it too. If that file has
independent local changes, GitVaulty asks what to do:

```text
.env has local changes

› Use local changes, then edit
  Discard local changes, then edit
  Cancel
```

For scripts, make local changes authoritative explicitly:

```sh
npx gitvaulty import --update .env
```

The updated encrypted file is decrypted and verified before replacing the previous version.

### VS Code

[Install GitVaulty from the Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=divB0.gitvaulty),
search for **GitVaulty** in VS Code's Extensions view, or run:

```sh
code --install-extension divb0.gitvaulty
```

The Marketplace provides native packages for macOS (Apple Silicon and Intel), Linux (ARM64 and
x64), and Windows x64.

To edit an encrypted file:

1. Open the local GitVaulty repository as a trusted VS Code workspace.
2. Select a `*.gitvaulty` file in the Explorer.
3. Edit the decrypted virtual document normally.
4. Save or use Auto Save to re-encrypt, verify, and atomically replace the ciphertext.

The virtual document keeps the plaintext filename for syntax highlighting and compatible language
features. GitVaulty does not materialize a plaintext repository file.

The extension detects ciphertext changes and refuses to overwrite a newer encrypted version. Native
editing means decrypted text is visible to VS Code, compatible extensions and language servers, and
possibly VS Code's private Hot Exit recovery storage. Use `gitvaulty edit` when that security boundary
is not appropriate.

See the [full VS Code guide](docs/vscode.md) for setup, commands, conflict handling, security details,
and troubleshooting.

## Local development

Materialize every file you can access:

```sh
npx gitvaulty materialize
```

Or select files by their plaintext paths:

```sh
npx gitvaulty materialize -f .env -f config/secrets.yaml
```

Materialized files receive mode `0600`. Existing files are accepted only when their bytes match the
encrypted source. Differing, symlinked, unsafe, or Git-tracked destinations are never overwritten.

Inspect their state:

```sh
npx gitvaulty status
```

```text
current  .env
missing  config/secrets.yaml
modified terraform/secrets.auto.tfvars.json
```

Remove materialized files when you no longer need them:

```sh
npx gitvaulty clean
```

`clean` removes only regular, untracked files whose bytes still match GitVaulty. Modified or unsafe
files are reported and kept.

## Ephemeral files while running a command

`run` materializes missing files, starts the command, and removes only the unchanged files that
this invocation created:

```sh
npx gitvaulty run -- npm start
```

With no `--file` options, it uses every file the current user may access. Limit the selection when
needed:

```sh
npx gitvaulty run -f .env.production -- npm start

npx gitvaulty run \
  -f terraform/secrets.auto.tfvars.json \
  -- terraform -chdir=terraform plan
```

GitVaulty materializes files; it does not interpret them or inject their contents as environment
variables. Applications and tools continue loading their native files normally. For plain Node.js:

```json
{
  "scripts": {
    "start": "node --env-file=.env src/server.js"
  }
}
```

If the child modifies a file created by `run`, GitVaulty keeps it and prints a warning. Existing
matching files are never owned or removed by `run`. Cleanup also runs after nonzero exits and common
termination signals; an uncatchable crash, power loss, or `SIGKILL` can still leave plaintext behind.

Private-key variables are available to SOPS but removed from the child process environment.

## Supported files

Whole-file encryption works with any regular file:

```text
.env.gitvaulty                          -> .env
config/secrets.yaml.gitvaulty           -> config/secrets.yaml
terraform/prod.tfvars.json.gitvaulty    -> terraform/prod.tfvars.json
certs/client.pem.gitvaulty              -> certs/client.pem
```

The `.gitvaulty` suffix is the only storage convention. All commands accept the path on the right,
without the suffix.

Because the complete byte stream is opaque, Git does not reveal keys or document structure. The
tradeoff is that Git cannot merge concurrent edits to the same encrypted file meaningfully; keep
files small and split unrelated secrets into separate files when different people edit them.

## Keys, users, and groups

```sh
npx gitvaulty key create
npx gitvaulty key public
npx gitvaulty key backup
npx gitvaulty key restore
npx gitvaulty user add
npx gitvaulty user list
npx gitvaulty user remove
npx gitvaulty group create production
npx gitvaulty group add production alice
npx gitvaulty group remove production alice
npx gitvaulty group list
npx gitvaulty group delete production
```

The global age identity normally lives at `~/.config/gitvaulty/identity.txt`. Back it up once with
`gitvaulty key backup`; the same identity works across GitVaulty repositories.

A new developer runs `gitvaulty key public` and sends the resulting public `age1...` recipient to
an existing user. `user add` asks which groups they should join, with `team` selected by default.
Private keys are never shared.

Change the policy of an existing file with one interactive command:

```sh
npx gitvaulty access .env.production
```

GitVaulty shows group grants first and direct-user exceptions second. For automation, set the exact
policy with repeatable flags:

```sh
npx gitvaulty access .env.production --group production --group platform --user alice
```

Adding or removing a group member automatically re-encrypts every affected file for its new exact
recipient set. A group cannot be deleted while a file uses it, and the default `team` group cannot
be deleted.

Removing a user rotates every affected file's data key and removes that recipient. It cannot erase
Git history or plaintext the user previously copied, so rotate external credentials after
offboarding.

CI and service accounts can inject a separate private identity:

```sh
GITVAULTY_KEY='AGE-SECRET-KEY-...' npx gitvaulty run -- npm start
```

`SOPS_AGE_KEY` is also supported. Mounted keys can use
`GITVAULTY_AGE_KEY_FILE=/secure/identity.txt` or `SOPS_AGE_KEY_FILE`.

## Install in a project

Install GitVaulty as a development dependency so everyone working on the project uses the same
version:

```sh
npm install --save-dev gitvaulty
```

Run the project's installed version with `npx`:

```sh
npx gitvaulty <command>
```

For example:

```sh
npx gitvaulty init
npx gitvaulty run -- npm start
```

### `npx` reports `uv_cwd`

`npx` asks npm to read the current working directory before GitVaulty starts. If that directory was
removed, or the operating system no longer permits access to it, npm can exit with
`process.cwd failed` and `uv_cwd`. Move to an accessible directory and rerun the command:

```sh
cd ~
npx gitvaulty key backup
```

Global key commands do not need to run inside a Git repository. If the error persists from an
accessible directory, check that the terminal has permission to access that directory.

## Repository layout

```text
.gitvaulty/recipients.json                    # public users, groups, and per-file access
.sops.yaml                                    # generated public SOPS rules
.env.gitvaulty                                # opaque encrypted .env bytes
terraform/prod.tfvars.json.gitvaulty          # opaque encrypted Terraform bytes
```

## Comparisons

Evaluating environment-secret tools? See [GitVaulty compared with dotenvx](https://github.com/divB0/gitvaulty/blob/main/docs/comparisons/dotenvx.md).

## License

MIT
