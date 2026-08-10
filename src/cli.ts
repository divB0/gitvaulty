#!/usr/bin/env node
import { checkbox, confirm, input, password, select } from "@inquirer/prompts";
import { Command } from "commander";
import { executeChecked } from "./process.js";
import { findRepository } from "./repository.js";
import { createIdentity, currentRecipient, identityFile, readIdentity, restoreIdentity } from "./key.js";
import { addUser, createVault, edit, initialize, removeUser, runWithVault } from "./operations.js";
import { normalizeUsername, parseRecipient } from "./recipient.js";
import { checkVault, renderVault } from "./templates.js";
import { readRegistry, type VaultUser } from "./registry.js";

async function localUsername(root: string): Promise<string> {
  for (const key of ["user.email", "user.name"]) {
    try {
      const value = (await executeChecked("git", ["config", "--get", key], { cwd: root })).stdout.trim().split("@", 1)[0] ?? "";
      if (value) return normalizeUsername(value);
    } catch { /* prompt fallback */ }
  }
  return "";
}

export function formatUsers(users: VaultUser[]): string {
  if (users.length === 0) return "No users.\n";
  const rows = users
    .map((user) => [user.username, parseRecipient(user.recipient).type, [...user.vaults].sort().join(", ")])
    .sort((left, right) => left[0]!.localeCompare(right[0]!));
  const allRows = [["USERNAME", "KEY", "VAULTS"], ...rows];
  const widths = [0, 1].map((column) => Math.max(...allRows.map((row) => row[column]!.length)));
  return `${allRows.map((row) => `${row[0]!.padEnd(widths[0]!)}  ${row[1]!.padEnd(widths[1]!)}  ${row[2]!}`).join("\n")}\n`;
}

async function hasIdentity(): Promise<boolean> {
  try { await readIdentity(); return true; }
  catch (error) {
    if ((error as Error).message.startsWith("No GitVaulty key found")) return false;
    throw error;
  }
}

async function ensureCliIdentity(): Promise<string> {
  if (await hasIdentity()) return currentRecipient();
  if (!await confirm({ message: "No GitVaulty key found. Create one now?", default: true })) throw new Error("A GitVaulty key is required.");
  const result = await createIdentity();
  process.stdout.write(`Created global key at ${identityFile()}.\nPublic recipient: ${result.recipient}\nBack it up with \`gitvaulty key backup\`.\n`);
  return result.recipient;
}

export function createProgram(): Command {
  const program = new Command().name("gitvaulty").description("Git-backed secrets for humans.").version("0.1.0").enablePositionalOptions();

  program.command("init").description("Initialize GitVaulty in this repository").action(async () => {
    const repo = await findRepository();
    const recipient = await ensureCliIdentity();
    const username = await input({ message: "Your username", default: await localUsername(repo.root), validate: (value) => { try { normalizeUsername(value); return true; } catch (error) { return (error as Error).message; } } });
    await initialize(repo, { username: normalizeUsername(username), recipient });
    process.stdout.write("GitVaulty initialized.\n");
  });

  const vault = program.command("vault").description("Manage encrypted vaults");
  vault.command("create <name>").description("Create an encrypted vault").action(async (name: string) => { await ensureCliIdentity(); const repo = await findRepository(); await createVault(repo, name); process.stdout.write(`Created vault ${name}.\n`); });
  vault.command("edit <name>").description("Edit an encrypted vault").action(async (name: string) => { await ensureCliIdentity(); await edit(await findRepository(), name); });
  vault.command("render <name>").description("Render a vault's templates").action(async (name: string) => { await ensureCliIdentity(); const repo = await findRepository(); const files = await renderVault(repo, name); process.stdout.write(`Rendered ${files.length} file${files.length === 1 ? "" : "s"}.\n`); });
  vault.command("check <name>").description("Check a vault's rendered files").action(async (name: string) => { await ensureCliIdentity(); const stale = await checkVault(await findRepository(), name); if (stale.length) { process.stderr.write(`Missing or stale:\n${stale.map((file) => `  ${file}`).join("\n")}\n`); process.exitCode = 1; } else process.stdout.write("Rendered files are current.\n"); });

  program.command("run <name> [command...]").description("Run a command with a vault's environment").allowUnknownOption(true).passThroughOptions().action(async (name: string, command: string[]) => { await ensureCliIdentity(); process.exitCode = await runWithVault(await findRepository(), name, command); });

  const key = program.command("key").description("Manage your global age key");
  key.command("create").description("Create a global age key").action(async () => {
    const result = await createIdentity();
    process.stdout.write(`Created global key at ${identityFile()}.\nPublic recipient: ${result.recipient}\nBack it up with \`gitvaulty key backup\`.\n`);
  });
  key.command("public").description("Print the public age recipient").action(async () => {
    process.stdout.write(`${await ensureCliIdentity()}\n`);
  });
  key.command("backup").description("Print the private key for backup").action(async () => {
    await ensureCliIdentity();
    if (!await confirm({ message: "Print your private GitVaulty key? Keep it secret.", default: false })) return;
    process.stdout.write(`${await readIdentity()}\n`);
  });
  key.command("restore").description("Restore a private key backup").action(async () => {
    const replace = await hasIdentity();
    if (replace && !await confirm({ message: "Replace the existing global GitVaulty key?", default: false })) return;
    const result = await restoreIdentity(await password({ message: "Paste your AGE-SECRET-KEY backup", mask: "*" }), identityFile(), replace);
    process.stdout.write(`Restored global key for ${result.recipient}.\n`);
  });

  const user = program.command("user").description("Manage vault access");
  user.command("add").description("Grant a user access to vaults").action(async () => {
    await ensureCliIdentity();
    const repo = await findRepository(); const registry = await readRegistry(repo);
    const vaults = [...new Set(registry.users.flatMap((item) => item.vaults))].sort();
    const publicKey = await input({ message: "Public key or age recipient", validate: (value) => { try { parseRecipient(value); return true; } catch (error) { return (error as Error).message; } } });
    const parsed = parseRecipient(publicKey);
    process.stdout.write(`Detected key type: ${parsed.type}\n`);
    const username = await input({ message: "Username", default: parsed.suggestedUsername, validate: (value) => { try { normalizeUsername(value); return true; } catch (error) { return (error as Error).message; } } });
    const selected = await checkbox({ message: "Vault access", choices: vaults.map((name) => ({ name, value: name })), required: true });
    const normalizedUsername = normalizeUsername(username);
    await addUser(repo, { username: normalizedUsername, recipient: parsed.recipient, vaults: selected }); process.stdout.write(`Added ${normalizedUsername}.\n`);
  });
  user.command("list").description("List users and vault access").action(async () => {
    process.stdout.write(formatUsers((await readRegistry(await findRepository())).users));
  });
  user.command("remove").description("Remove a user's vault access").action(async () => {
    await ensureCliIdentity();
    const repo = await findRepository(); const registry = await readRegistry(repo); const mine = await currentRecipient();
    const candidates = registry.users.filter((item) => item.recipient !== mine);
    if (!candidates.length) throw new Error("There are no other users to remove.");
    const username = await select({ message: "Remove user", choices: candidates.map((item) => ({ name: item.username, value: item.username })) });
    if (!await confirm({ message: `Remove ${username} and rotate affected vault keys?`, default: false })) return;
    await removeUser(repo, username); process.stdout.write(`Removed ${username}. Rotate external provider credentials they knew.\n`);
  });
  return program;
}

export async function main(argv = process.argv): Promise<void> { await createProgram().parseAsync(argv); }

if (import.meta.url === `file://${process.argv[1]}`) main().catch((error: unknown) => { process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
