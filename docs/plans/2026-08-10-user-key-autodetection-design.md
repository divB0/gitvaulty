# User key autodetection design

## Goal

Keep access management limited to three obvious commands:

```text
gitvaulty user add
gitvaulty user list
gitvaulty user remove
```

Users paste one public recipient. GitVaulty detects whether it is a native age recipient or an SSH
Ed25519 public key, normalizes it, and shows the detected type before changing any vault. Private
keys and recovery keys must never be entered into `user add` or stored in the repository.

## Usernames

The registry calls the human-facing identifier `username`, not `id`. Usernames are unique,
lowercase handles containing letters, numbers, `.`, `_`, and `-`. They begin and end with a letter
or number.

An age recipient contains no username. An SSH public key may end in a comment, but that comment is
optional and unauthenticated. GitVaulty may turn a simple comment such as `alice@laptop` into the
suggested username `alice`, but it always presents the username prompt for confirmation. The
confirmed username, not the key comment, is stored in the registry.

## Adding a user

`user add` first asks for `Public key or age recipient`. Recipient parsing recognizes:

- native classic age recipients beginning with `age1`;
- OpenSSH Ed25519 public keys beginning with `ssh-ed25519`.

SSH comments are discarded before storage and duplicate comparison. Unsupported prefixes,
malformed base64, private keys, RSA keys, and empty values are rejected with examples of the two
accepted public formats. Shape detection selects a parser; successful parser validation, not the
prefix alone, determines acceptance.

After parsing, the command prints the detected type, asks for a confirmed username, and presents
the existing vault checklist. The authorized operator decides the final vault access. Registry,
SOPS configuration, and affected encrypted files retain the current transactional behavior: a
failed SOPS update restores all snapshots and leaves no partially added user.

## Listing and removing users

`user list` is non-interactive and prints stable columns for username, key type, and vaults. It does
not expose full key material by default. A short recipient fingerprint or abbreviated recipient may
be added later if ambiguity becomes a real problem.

`user remove` keeps the interactive user selector and explicit confirmation. It removes the stored
recipient, rotates affected vault data keys, and reports that external credentials and historical
Git access still require separate handling.

## Local SSH identity behavior

SOPS may use the matching SSH private key for decryption. GitVaulty initially supports the
conventional `~/.ssh/id_ed25519` key pair. When no native age identity exists, GitVaulty compares
the normalized local `id_ed25519.pub` recipient with the registry to identify the current user. A
missing key, no registry match, or multiple matches produces an actionable error rather than an
identity guess. Custom SSH paths and agent-only or hardware-backed SSH identities are outside this
first iteration.

## Registry and validation

`VaultUser.id` becomes `VaultUser.username`. No compatibility migration is required. Registry
validation normalizes usernames and recipients before checking uniqueness, so casing differences
or SSH comments cannot create duplicate users. SOPS remains the final encryption compatibility
check, while GitVaulty rejects invalid input before writing whenever possible.

## Tests

Unit tests cover username normalization, SSH comment handling, recipient type detection, malformed
and private-key rejection, and duplicate normalized recipients. CLI tests cover the three command
names, prompts, detection confirmation, and deterministic list output. Integration tests add and
remove both age and SSH recipients, verify rollback after a SOPS error, and decrypt an SSH-encrypted
fixture using a repository test key.
