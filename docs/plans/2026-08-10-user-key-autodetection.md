# User Key Autodetection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add simple `user add`, `user list`, and `user remove` workflows that accept validated native age or SSH Ed25519 public recipients and use confirmed usernames.

**Architecture:** Put recipient parsing and normalization in a small pure module, then make the registry store normalized usernames and recipients. Extend local identity discovery to consider the repository age identity and the conventional SSH Ed25519 public key, while keeping CLI prompts thin over library operations.

**Tech Stack:** TypeScript, Commander, Inquirer, Node.js crypto/fs APIs, SOPS, Vitest

---

### Task 1: Parse recipients and usernames

**Files:**
- Create: `src/recipient.ts`
- Create: `test/recipient.test.ts`
- Modify: `src/index.ts`

**Step 1: Write failing parser tests**

Cover a valid 62-character native age recipient, a structurally valid OpenSSH Ed25519 recipient,
SSH comment removal, username suggestions, invalid age checksums, malformed SSH wire payloads,
private-key rejection, and lowercase username validation.

**Step 2: Run the focused test and confirm failure**

Run: `npm test -- --run test/recipient.test.ts`

Expected: FAIL because `src/recipient.ts` does not exist.

**Step 3: Implement the pure parser**

Add:

```ts
export type RecipientType = "age" | "ssh-ed25519";
export interface ParsedRecipient {
  recipient: string;
  type: RecipientType;
  suggestedUsername?: string;
}

export function parseRecipient(input: string): ParsedRecipient;
export function normalizeUsername(input: string): string;
```

Validate the Bech32 checksum and expected classic-age length. Decode the SSH base64 payload and
verify its length-prefixed algorithm and 32-byte Ed25519 public-key fields. Store SSH recipients as
`ssh-ed25519 <base64>` without a comment. Treat comments only as optional username suggestions.

**Step 4: Run the focused test**

Run: `npm test -- --run test/recipient.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/recipient.ts src/index.ts test/recipient.test.ts
git commit -m "feat: parse public recipients"
```

### Task 2: Store usernames and discover local recipients

**Files:**
- Modify: `src/registry.ts`
- Modify: `src/key.ts`
- Modify: `src/operations.ts`
- Modify: `src/index.ts`
- Modify: `test/integration.test.ts`
- Create: `test/registry.test.ts`

**Step 1: Write failing registry and identity tests**

Assert that registry users contain `username`, are sorted by username, reject normalized duplicates,
and accept age and SSH Ed25519 recipients. Assert that local recipient discovery returns the native
age recipient plus a normalized `~/.ssh/id_ed25519.pub` recipient when present.

**Step 2: Run the focused tests and confirm failure**

Run: `npm test -- --run test/registry.test.ts test/integration.test.ts`

Expected: FAIL on the old `id` schema and missing local-recipient API.

**Step 3: Implement the schema and discovery**

Change the public model to:

```ts
export interface VaultUser {
  username: string;
  recipient: string;
  vaults: string[];
}
```

Normalize every user before write and validate registry contents on read. Add
`currentRecipients(repo, homeDirectory?)`, returning zero or more locally available public
recipients. Update vault creation and removal-self filtering to match the registry against this set.
If no registered local recipient can be identified for an operation that requires one, return an
actionable error.

Only set GitVaulty's default `SOPS_AGE_KEY_FILE` when the repository age identity exists; otherwise
allow SOPS to discover its conventional SSH identity.

**Step 4: Run the focused tests**

Run: `npm test -- --run test/registry.test.ts test/integration.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/registry.ts src/key.ts src/operations.ts src/sops.ts src/index.ts test/registry.test.ts test/integration.test.ts
git commit -m "feat: support username recipient registry"
```

### Task 3: Complete the three user commands

**Files:**
- Modify: `src/cli.ts`
- Modify: `test/cli.test.ts`

**Step 1: Write failing CLI tests**

Require the `user` subcommands to be exactly `add`, `list`, and `remove`. Test deterministic list
formatting with username, detected key type, and sorted vault names.

**Step 2: Run the focused test and confirm failure**

Run: `npm test -- --run test/cli.test.ts`

Expected: FAIL because `list` is missing.

**Step 3: Implement the CLI behavior**

Make `user add` ask for the recipient first, print the detected type, offer a confirmed username
default when an SSH comment provides one, and then select vault access. Add non-interactive
`user list` output. Keep `user remove` interactive and exclude every locally matched recipient.

**Step 4: Run the focused test**

Run: `npm test -- --run test/cli.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/cli.ts test/cli.test.ts
git commit -m "feat: simplify user access commands"
```

### Task 4: Document and verify the feature

**Files:**
- Modify: `README.md`

**Step 1: Update user documentation**

Document all three commands, accepted public formats, username confirmation, SSH default-key
location, and the rule that private or recovery keys are never shared.

**Step 2: Run full verification**

Run: `npm run check`

Expected: typecheck, all tests, build, and CLI help smoke test pass.

Run: `git diff --check`

Expected: no output.

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: explain user key onboarding"
```
