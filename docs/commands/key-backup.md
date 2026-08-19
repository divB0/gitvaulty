# `gitvaulty key backup`

Print your private age identity so it can be stored in a secure backup.

## Usage

```sh
npx gitvaulty key backup
```

GitVaulty first ensures an identity exists. If it is missing interactively, GitVaulty offers masked
restoration from a backup, creation of a new key, or cancellation. It then asks:

```text
Print your private GitVaulty key? Keep it secret. (y/N)
```

The default is no. After confirmation, the command writes the raw `AGE-SECRET-KEY-...` value to standard output.

## Security

Anyone with this value can decrypt every GitVaulty file addressed to the corresponding public recipient. Store it in a password manager or another encrypted backup. Do not paste it into chat, commit it, include it in shell history, or save command output to an unencrypted repository file.

The command does not require an initialized repository and does not modify the identity or repository.

## Related commands

- [`gitvaulty key restore`](key-restore.md)
- [`gitvaulty key public`](key-public.md)
