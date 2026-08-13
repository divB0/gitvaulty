# `gitvaulty user remove`

Remove a registered user from repository access and update affected ciphertext.

## Usage

```sh
npx gitvaulty user remove
```

GitVaulty presents a list of users other than the identity running the command. After selection, it asks for confirmation:

```text
Remove <username> and rotate affected file keys? (y/N)
```

The default is no.

## What it changes

After confirmation, GitVaulty removes the user:

- from `.gitvaulty/recipients.json`;
- from every group membership;
- from every direct file grant.

It regenerates `.sops.yaml` and re-encrypts every file whose effective recipient set changed. If the removed user still had equivalent access through no remaining policy—which is normally the result after deleting the user—the new ciphertext no longer contains their recipient.

You cannot remove the user corresponding to your current private identity. The operation also refuses any change that would remove your own access from an affected file. If a write or re-encryption fails, the previous registry, SOPS configuration, and ciphertext are restored.

## Revocation limits

New ciphertext prevents the removed private key from decrypting future repository versions. It does not revoke plaintext or historical ciphertext the user already copied. Rotate external credentials they knew, as the command's completion message reminds you.

The command does not stage or commit modified files.

## Related commands

- [`gitvaulty group remove`](group-remove.md)
- [`gitvaulty access`](access.md)
- [`gitvaulty user list`](user-list.md)
