# Signed Group Policies

GitVaulty will separate the ability to read a group's secrets from the ability to change that group's membership. Every manager is also a member, so managers can decrypt and re-encrypt affected files. Ordinary members can decrypt, but their signatures cannot authorize a group-policy revision.

## Identity

Each person manages one GitVaulty master identity. The stored backup contains one random 32-byte master secret. GitVaulty derives two purpose-separated keys just in time with HKDF-SHA-256:

- a native age/X25519 identity for file encryption and decryption;
- an Ed25519 identity for group-policy signatures.

Derived private keys live only for the command's lifetime. The repository stores the public age recipient and public Ed25519 verification key. This gives users one identity file and one backup while avoiding reuse of one mathematical key across encryption and signing protocols.

## Signed policy history

Registry version 4 stores an append-only policy history for each group. A policy revision contains the group name through its parent record, a monotonic revision, the previous signed-policy hash, the sorted managers, and a signed snapshot of every member's username, age recipient, and signing public key. Binding public keys inside the signed policy prevents a registry edit from silently replacing a member's encryption key.

The first revision is signed by the group creator, who becomes its first manager and member. Every later revision must be signed by a manager from the immediately preceding revision. GitVaulty verifies the complete chain whenever it reads the registry. Git history supplies the initial trust anchor: a fresh clone must trust or independently verify the repository's first accepted policy commit.

At least one manager is required, every manager must be a member, and a manager must be demoted before being removed. Manager changes and membership changes create new signed revisions. Removing a manager rotates authority through the new revision; repository review and CI must reject stale forks based on older revisions.

## Operations and failure handling

Creating a group automatically makes its creator manager and member. Adding or removing members, promoting or demoting managers, and deleting a group require the current identity to be a manager. GitVaulty signs the next policy before modifying encrypted files, decrypts every affected file with the manager's age identity, writes the new registry and SOPS configuration, re-encrypts with the exact signed recipients, and rolls back registry and ciphertext snapshots on failure.

User self-registration publishes both public keys without granting access. Managers subsequently grant access through signed group revisions. Direct file grants remain explicit exceptions: an authorized reader can already disclose plaintext, while group-policy signatures prevent an ordinary member from presenting an unauthorized membership edit as manager-approved.

The CLI will display managers separately from members and provide manager promotion/demotion commands. Invalid signatures, broken revision chains, substituted keys, non-manager mutations, empty manager sets, and attempts to remove a manager as an ordinary member all fail before ciphertext or registry changes.

## Release and verification

This changes the identity backup and registry formats and is therefore released as GitVaulty 1.0.0. The test suite will cover deterministic derivation, signing and tamper detection, policy-chain validation, manager authorization, transactional re-encryption, CLI output, and the four-person end-to-end scenario. The README, command documentation, agent skill, and generated demo must describe the new trust and recovery model.
