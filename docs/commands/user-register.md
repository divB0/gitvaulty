# `gitvaulty user register`

Register your public encryption and signing keys without granting yourself access.

## Usage

```sh
npx gitvaulty user register <username>
```

Example:

```sh
npx gitvaulty user register alice
```

The username is normalized to lowercase and must use letters, numbers, `.`, `_`, or `-`. GitVaulty
loads your global master identity and derives its public `age1...` recipient and `ed25519:...`
verification key. If no identity exists, it asks whether to create one. The private
`GITVAULTY-IDENTITY-...` value is never written to the
repository.

## What it changes

GitVaulty adds the username and both public keys to `.gitvaulty/recipients.json` with no group
memberships and no direct file grants. Existing groups, file policies, effective recipients, and
ciphertext remain unchanged. The username and both public keys must be unique.

The command requires an initialized GitVaulty repository but does not require access to any
encrypted file. It does not stage or commit the registry change.

## Complete onboarding

Commit the public registration on your branch:

```sh
git add .gitvaulty/recipients.json
git commit -m "chore: register alice's GitVaulty key"
```

After reviewing that commit, a current manager of the target group grants access:

```sh
npx gitvaulty group add team alice
```

The group command re-encrypts affected files for the new recipient. Registration alone never grants
secret access.

## Related commands

- [`gitvaulty group add`](group-add.md)
- [`gitvaulty user add`](user-add.md)
- [`gitvaulty key public`](key-public.md)
- [`gitvaulty user list`](user-list.md)
