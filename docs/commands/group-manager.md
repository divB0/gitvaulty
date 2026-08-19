# `gitvaulty group manager`

Promote or demote managers of a signed access group.

## Usage

```sh
npx gitvaulty group manager add <group> <username>
npx gitvaulty group manager remove <group> <username>
```

Only a current manager can run either operation. A promoted user must already be a group member. Demotion keeps the user as an ordinary member, so they retain decryption access but can no longer authorize later group revisions.

Every group must retain at least one manager. Every manager is always a member. Each change appends a policy revision signed by a manager from the preceding revision; manager changes do not re-encrypt secret files when the member set stays unchanged.

The commands do not stage or commit the updated registry. Protect and review `.gitvaulty/recipients.json` in Git so the accepted policy history cannot be replaced wholesale.
