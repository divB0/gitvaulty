import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { createIdentity, type StoredIdentity } from "../src/key.js";
import {
  appendGroupPolicy,
  createGroupPolicy,
  currentGroupPolicy,
  normalizeGitVaultyGroup,
  policyHash,
  type GroupPolicyMember,
} from "../src/group-policy.js";

async function identity(username: string): Promise<{ master: StoredIdentity; member: GroupPolicyMember }> {
  const root = await mkdtemp(path.join(os.tmpdir(), `gitvaulty-${username}-`));
  const master = await createIdentity(path.join(root, "identity.txt"));
  return {
    master,
    member: { username, recipient: master.recipient, signingKey: master.signingKey },
  };
}

describe("signed group policies", () => {
  it("creates a signed genesis policy and appends manager-authorized revisions", async () => {
    const alice = await identity("alice");
    const bob = await identity("bob");
    const genesis = await createGroupPolicy("Dev", [alice.member], ["alice"], "alice", alice.master.identity);
    expect(currentGroupPolicy(genesis)).toMatchObject({
      revision: 1,
      previous: null,
      managers: ["alice"],
      members: [alice.member],
      signedBy: "alice",
    });

    const updated = await appendGroupPolicy(
      genesis,
      [alice.member, bob.member],
      ["alice"],
      "alice",
      alice.master.identity,
    );
    expect(updated.policies).toHaveLength(2);
    expect(currentGroupPolicy(updated)).toMatchObject({
      revision: 2,
      previous: policyHash("dev", genesis.policies[0]!),
      managers: ["alice"],
      members: [alice.member, bob.member],
      signedBy: "alice",
    });
    expect(normalizeGitVaultyGroup(updated)).toEqual(updated);
  });

  it("rejects revisions signed by an ordinary member", async () => {
    const alice = await identity("alice");
    const bob = await identity("bob");
    const group = await createGroupPolicy("dev", [alice.member, bob.member], ["alice"], "alice", alice.master.identity);
    await expect(appendGroupPolicy(
      group,
      [alice.member, bob.member],
      ["alice", "bob"],
      "bob",
      bob.master.identity,
    )).rejects.toThrow("manager of dev");
  });

  it("detects member, key, signature, hash-chain, and signer tampering", async () => {
    const alice = await identity("alice");
    const bob = await identity("bob");
    const group = await createGroupPolicy("dev", [alice.member], ["alice"], "alice", alice.master.identity);
    const updated = await appendGroupPolicy(group, [alice.member, bob.member], ["alice"], "alice", alice.master.identity);

    const memberTamper = structuredClone(updated);
    memberTamper.policies[1]!.members[1]!.username = "mallory";
    expect(() => normalizeGitVaultyGroup(memberTamper)).toThrow("Invalid signature for dev revision 2");

    const keyTamper = structuredClone(updated);
    keyTamper.policies[1]!.members[1]!.recipient = alice.member.recipient;
    expect(() => normalizeGitVaultyGroup(keyTamper)).toThrow();

    const signatureTamper = structuredClone(updated);
    signatureTamper.policies[1]!.signature = "ed25519:invalid";
    expect(() => normalizeGitVaultyGroup(signatureTamper)).toThrow("Invalid signature for dev revision 2");

    const chainTamper = structuredClone(updated);
    chainTamper.policies[1]!.previous = "sha256:invalid";
    expect(() => normalizeGitVaultyGroup(chainTamper)).toThrow("Invalid previous policy hash");

    const signerTamper = structuredClone(updated);
    signerTamper.policies[1]!.signedBy = "bob";
    expect(() => normalizeGitVaultyGroup(signerTamper)).toThrow("not a manager");
  });

  it("requires at least one manager and makes every manager a member", async () => {
    const alice = await identity("alice");
    await expect(createGroupPolicy("dev", [alice.member], [], "alice", alice.master.identity)).rejects.toThrow("at least one manager");
    await expect(createGroupPolicy("dev", [alice.member], ["bob"], "alice", alice.master.identity)).rejects.toThrow("Managers must be group members");
  });
});
