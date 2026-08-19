import { createHash } from "node:crypto";
import { GitVaultyError } from "./errors.js";
import {
  deriveIdentity,
  parseSigningKey,
  signMessage,
  verifyMessage,
} from "./key.js";
import { normalizeUsername, parseRecipient } from "./recipient.js";

export interface GroupPolicyMember {
  username: string;
  recipient: string;
  signingKey: string;
}

export interface GroupPolicy {
  revision: number;
  previous: string | null;
  managers: string[];
  members: GroupPolicyMember[];
  signedBy: string;
  signature: string;
}

export interface GitVaultyGroup {
  name: string;
  policies: GroupPolicy[];
}

export function normalizeGroupName(input: string): string {
  try { return normalizeUsername(input); }
  catch { throw new GitVaultyError("Enter a group name using lowercase letters, numbers, '.', '_', or '-'."); }
}

function normalizeMember(value: GroupPolicyMember): GroupPolicyMember {
  if (!value || typeof value !== "object") throw new GitVaultyError("Invalid group member identity.");
  return {
    username: normalizeUsername(value.username),
    recipient: parseRecipient(value.recipient),
    signingKey: parseSigningKey(value.signingKey),
  };
}

function normalizeMembers(values: GroupPolicyMember[]): GroupPolicyMember[] {
  if (!Array.isArray(values)) throw new GitVaultyError("Invalid group member identities.");
  const members = values.map(normalizeMember).sort((left, right) => left.username.localeCompare(right.username));
  if (new Set(members.map((member) => member.username)).size !== members.length) throw new GitVaultyError("Duplicate group member.");
  if (new Set(members.map((member) => member.recipient)).size !== members.length) throw new GitVaultyError("Duplicate group member recipient.");
  if (new Set(members.map((member) => member.signingKey)).size !== members.length) throw new GitVaultyError("Duplicate group member signing key.");
  return members;
}

function normalizeManagers(values: string[], members: GroupPolicyMember[]): string[] {
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string")) throw new GitVaultyError("Invalid group managers.");
  const managers = [...new Set(values.map(normalizeUsername))].sort();
  if (managers.length === 0) throw new GitVaultyError("A group needs at least one manager.");
  const usernames = new Set(members.map((member) => member.username));
  if (managers.some((manager) => !usernames.has(manager))) throw new GitVaultyError("Managers must be group members.");
  return managers;
}

function normalizePolicy(value: GroupPolicy): GroupPolicy {
  if (
    !value || typeof value !== "object"
    || !Number.isSafeInteger(value.revision) || value.revision < 1
    || (value.previous !== null && typeof value.previous !== "string")
    || typeof value.signedBy !== "string"
    || typeof value.signature !== "string"
  ) throw new GitVaultyError("Invalid signed group policy.");
  const members = normalizeMembers(value.members);
  return {
    revision: value.revision,
    previous: value.previous,
    managers: normalizeManagers(value.managers, members),
    members,
    signedBy: normalizeUsername(value.signedBy),
    signature: value.signature,
  };
}

function payload(groupName: string, policy: Omit<GroupPolicy, "signature">): Buffer {
  return Buffer.from(JSON.stringify({
    domain: "gitvaulty/group-policy/v1",
    group: normalizeGroupName(groupName),
    revision: policy.revision,
    previous: policy.previous,
    managers: policy.managers,
    members: policy.members,
    signedBy: policy.signedBy,
  }), "utf8");
}

export function policyHash(groupName: string, policy: GroupPolicy): string {
  return `sha256:${createHash("sha256").update(JSON.stringify({
    domain: "gitvaulty/group-policy-hash/v1",
    group: normalizeGroupName(groupName),
    policy,
  })).digest("hex")}`;
}

function signerFor(policy: GroupPolicy, username: string): GroupPolicyMember | undefined {
  return policy.members.find((member) => member.username === username);
}

function verifyPolicy(groupName: string, policy: GroupPolicy, previous: GroupPolicy | undefined): void {
  if (previous === undefined) {
    if (policy.revision !== 1 || policy.previous !== null) throw new GitVaultyError(`Invalid genesis policy for ${groupName}.`);
    if (!policy.managers.includes(policy.signedBy)) throw new GitVaultyError(`Policy signer is not a manager of ${groupName}.`);
  } else {
    if (policy.revision !== previous.revision + 1) throw new GitVaultyError(`Invalid policy revision for ${groupName}.`);
    if (policy.previous !== policyHash(groupName, previous)) throw new GitVaultyError(`Invalid previous policy hash for ${groupName} revision ${policy.revision}.`);
    if (!previous.managers.includes(policy.signedBy)) throw new GitVaultyError(`Policy signer is not a manager of ${groupName}.`);
  }
  const signer = signerFor(previous ?? policy, policy.signedBy);
  const unsigned = { ...policy };
  delete (unsigned as Partial<GroupPolicy>).signature;
  if (!signer || !verifyMessage(signer.signingKey, payload(groupName, unsigned), policy.signature)) {
    throw new GitVaultyError(`Invalid signature for ${groupName} revision ${policy.revision}.`);
  }
}

export function normalizeGitVaultyGroup(value: GitVaultyGroup): GitVaultyGroup {
  if (!value || typeof value !== "object" || !Array.isArray(value.policies) || value.policies.length === 0) {
    throw new GitVaultyError("Invalid group entry.");
  }
  const name = normalizeGroupName(value.name);
  const policies = value.policies.map(normalizePolicy);
  for (const [index, policy] of policies.entries()) verifyPolicy(name, policy, policies[index - 1]);
  return { name, policies };
}

export function currentGroupPolicy(group: GitVaultyGroup): GroupPolicy {
  const policy = group.policies.at(-1);
  if (!policy) throw new GitVaultyError(`Group has no signed policy: ${group.name}`);
  return policy;
}

async function signedPolicy(
  groupName: string,
  unsigned: Omit<GroupPolicy, "signature">,
  masterIdentity: string,
  expectedSigner: GroupPolicyMember,
): Promise<GroupPolicy> {
  const local = await deriveIdentity(masterIdentity);
  if (local.recipient !== expectedSigner.recipient || local.signingKey !== expectedSigner.signingKey) {
    throw new GitVaultyError(`The current identity does not belong to ${unsigned.signedBy}.`);
  }
  return {
    ...unsigned,
    signature: await signMessage(masterIdentity, payload(groupName, unsigned)),
  };
}

export async function createGroupPolicy(
  name: string,
  membersInput: GroupPolicyMember[],
  managersInput: string[],
  signedByInput: string,
  masterIdentity: string,
): Promise<GitVaultyGroup> {
  const groupName = normalizeGroupName(name);
  const members = normalizeMembers(membersInput);
  const managers = normalizeManagers(managersInput, members);
  const signedBy = normalizeUsername(signedByInput);
  if (!managers.includes(signedBy)) throw new GitVaultyError(`Policy signer is not a manager of ${groupName}.`);
  const signer = members.find((member) => member.username === signedBy)!;
  const policy = await signedPolicy(groupName, {
    revision: 1,
    previous: null,
    managers,
    members,
    signedBy,
  }, masterIdentity, signer);
  return normalizeGitVaultyGroup({ name: groupName, policies: [policy] });
}

export async function appendGroupPolicy(
  groupInput: GitVaultyGroup,
  membersInput: GroupPolicyMember[],
  managersInput: string[],
  signedByInput: string,
  masterIdentity: string,
): Promise<GitVaultyGroup> {
  const group = normalizeGitVaultyGroup(groupInput);
  const previous = currentGroupPolicy(group);
  const signedBy = normalizeUsername(signedByInput);
  if (!previous.managers.includes(signedBy)) throw new GitVaultyError(`${signedBy} is not a manager of ${group.name}.`);
  const signer = signerFor(previous, signedBy)!;
  const members = normalizeMembers(membersInput);
  const managers = normalizeManagers(managersInput, members);
  const policy = await signedPolicy(group.name, {
    revision: previous.revision + 1,
    previous: policyHash(group.name, previous),
    managers,
    members,
    signedBy,
  }, masterIdentity, signer);
  return normalizeGitVaultyGroup({ name: group.name, policies: [...group.policies, policy] });
}
