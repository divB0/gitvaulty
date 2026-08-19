# `gitvaulty user register`

Register your public age recipient in a repository without granting yourself access.

## Usage

```sh
npx gitvaulty user register <username>
```

Example:

```sh
npx gitvaulty user register alice
```

The username is normalized to lowercase and must use letters, numbers, `.`, `_`, or `-`. GitVaulty
loads your global age identity and derives its public `age1...` recipient. If no identity exists, it
offers masked restoration from a backup or creation of a new key. The private
`AGE-SECRET-KEY-...` identity is never written to the repository.

## What it changes

GitVaulty adds the username and public recipient to `.gitvaulty/recipients.json` with no group
memberships and no direct file grants. Existing groups, file policies, effective recipients, and
ciphertext remain unchanged. Both the username and recipient must be unique.

The command prepares the repository automatically when needed and does not require access to any
encrypted file. In a new repository, its `<username>` becomes the repository owner in the default
`team` group instead of adding a duplicate registration. It does not stage or commit the registry
change.

## Complete onboarding

Commit the public registration on your branch:

```sh
git add .gitvaulty/recipients.json
git commit -m "chore: register alice's GitVaulty key"
```

After reviewing that commit, an existing authorized developer grants a group:

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
