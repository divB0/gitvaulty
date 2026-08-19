# Signed Group Policies Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make group membership cryptographically manager-controlled while keeping one user-managed GitVaulty identity.

**Architecture:** A master secret derives native age/X25519 and Ed25519 keys with domain-separated HKDF labels. Registry v4 stores each user's public keys and an append-only, manager-signed policy chain per group; group mutations append a verified revision before transactionally re-encrypting affected files.

**Tech Stack:** TypeScript, Node.js crypto, `@scure/base`, age, SOPS, Vitest, Commander, VHS.

---

### Task 1: Master identity and signing primitives

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/key.ts`
- Modify: `src/sops.ts`
- Modify: `src/index.ts`
- Test: `test/key.test.ts`
- Test: `test/sops.test.ts`

1. Add failing tests for one master backup deriving stable, distinct age and Ed25519 public keys.
2. Add failing tests for Ed25519 sign/verify and malformed master identities.
3. Implement the bech32 master identity, HKDF derivation, public-key serialization, and in-memory signing.
4. Make SOPS receive the derived age identity instead of the master identity file.
5. Run focused key and SOPS tests, then commit.

### Task 2: Registry v4 policy chains

**Files:**
- Create: `src/group-policy.ts`
- Modify: `src/registry.ts`
- Modify: `src/index.ts`
- Test: `test/registry.test.ts`
- Create: `test/group-policy.test.ts`

1. Add failing tests for signed genesis policies, valid chained revisions, and recipient resolution.
2. Add failing tests for tampered members, substituted keys, broken hashes, unauthorized signers, and invalid manager/member invariants.
3. Implement canonical policy payloads, signing, hashing, normalization, and full-chain verification.
4. Upgrade registry normalization and SOPS recipient generation to use the latest signed policy.
5. Run focused policy and registry tests, then commit.

### Task 3: Manager-authorized operations

**Files:**
- Modify: `src/operations.ts`
- Modify: `src/index.ts`
- Test: `test/operations.test.ts`
- Test: `test/integration.test.ts`

1. Add failing tests showing the creator is a manager/member and an ordinary member cannot change policy.
2. Add failing tests for manager add/remove, member add/remove, user removal, and group deletion authorization.
3. Implement manager checks and signed revision appends inside the existing rollback transaction.
4. Verify additions and removals re-encrypt exact recipients and rejected actions leave all files unchanged.
5. Run focused operation and integration tests, then commit.

### Task 4: CLI, version, and documentation

**Files:**
- Modify: `src/cli.ts`
- Modify: `test/cli.test.ts`
- Modify: `test/cli_options.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `README.md`
- Modify: `docs/commands/*.md`
- Modify: `skills/gitvaulty/SKILL.md`

1. Add failing CLI tests for public identity output, manager/member listings, and manager commands.
2. Update initialization and registration to publish both public keys.
3. Add `group manager add` and `group manager remove`; clarify manager-only membership mutations.
4. Bump the package to 1.0.0 and document the major identity/registry change and trust model.
5. Run CLI tests, type checking, and package build, then commit.

### Task 5: End-to-end demo and final verification

**Files:**
- Modify: `demos/access-control-demo.sh`
- Modify: `demos/access-control.tape`
- Modify: `docs/demo/instructions.md`
- Modify: `demos/access-control.gif`

1. Update the four-person scenario so Admin creates and manages `dev` and `sre`, while ordinary members only read.
2. Show signed manager-authorized onboarding of Jules and confirm Jules decrypts local but not production.
3. Run `npm run demo:generate` and visually inspect representative frames.
4. Run `npm run check` and inspect the final diff and clean status.
5. Commit the demo/release changes, merge the branch into `main`, and remove the worktree.
