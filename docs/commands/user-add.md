# `gitvaulty user add`

Register another person's public GitVaulty identity and add that user to one or more groups.

This is a manager shortcut for cases where you already received both public keys
out of band. The preferred reviewable onboarding flow is for the new developer to run
[`gitvaulty user register`](user-register.md), commit that public registration, and have an existing
manager grant access with [`gitvaulty group add`](group-add.md).

## Usage

```sh
npx gitvaulty user add
```

The command prompts for:

1. A valid public recipient beginning with `age1`.
2. A public Ed25519 signing key.
3. A username.
4. One or more groups. The default group is preselected.

The username and both public keys must be unique. Ask the new user to obtain them with [`gitvaulty key public`](key-public.md); never ask them to share a `GITVAULTY-IDENTITY-...` backup.

## What it changes

GitVaulty adds the user to `.gitvaulty/recipients.json` and to the selected groups. Files granted to those groups gain the new recipient and are re-encrypted while preserving their plaintext bytes. `.sops.yaml` is regenerated to reflect the effective recipients.

The current identity must manage every selected group and be able to decrypt every affected file. Each membership change is signed. If registry writing or re-encryption fails, GitVaulty restores the previous registry, SOPS configuration, and ciphertext.

The command does not stage or commit modified files.

## Related commands

- [`gitvaulty user register`](user-register.md)
- [`gitvaulty user list`](user-list.md)
- [`gitvaulty group add`](group-add.md)
- [`gitvaulty user remove`](user-remove.md)
