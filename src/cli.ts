#!/usr/bin/env node
import { checkbox, confirm, input, password, select } from "@inquirer/prompts";
import { Command } from "commander";
import { executeChecked } from "./process.js";
import { findRepository } from "./repository.js";
import { currentRecipient, generateKey, importKey, readIdentity } from "./key.js";
import { addUser, createVault, edit, initialize, removeUser, runWithVault } from "./operations.js";
import { checkVault, renderVault } from "./templates.js";
import { readRegistry } from "./registry.js";

async function localUserId(root: string): Promise<string> {
  for (const key of ["user.email", "user.name"]) {
    try { const value = (await executeChecked("git", ["config", "--get", key], { cwd: root })).stdout.trim(); if (value) return value; } catch { /* prompt fallback */ }
  }
  return "";
}

async function ensureLocalKey(repo: Awaited<ReturnType<typeof findRepository>>): Promise<string> {
  try { await readIdentity(repo); return currentRecipient(repo); }
  catch {
    const method = await select({ message: "Set up your repository key", choices: [{ name: "Generate a new key", value: "generate" }, { name: "Import an existing key", value: "import" }] });
    if (method === "generate") {
      const result = await generateKey(repo);
      process.stdout.write(`\nRecovery key (shown once — store it securely):\n${result.identity}\n\n`);
      return result.recipient;
    }
    const result = await importKey(repo, await password({ message: "Paste your age private key", mask: "*" }));
    return result.recipient;
  }
}

export function createProgram(): Command {
  const program = new Command().name("gitvaulty").description("Git-backed secrets for humans.").version("0.1.0").enablePositionalOptions();

  program.command("init").description("Initialize GitVaulty in this repository").action(async () => {
    const repo = await findRepository();
    const recipient = await ensureLocalKey(repo);
    const id = await input({ message: "Your user ID", default: await localUserId(repo.root), validate: (value) => value.trim() ? true : "Enter a user ID" });
    await initialize(repo, { id: id.trim(), recipient });
    process.stdout.write("GitVaulty initialized.\n");
  });

  const vault = program.command("vault").description("Manage encrypted vaults");
  vault.command("create <name>").description("Create an encrypted vault").action(async (name: string) => { const repo = await findRepository(); await createVault(repo, name); process.stdout.write(`Created vault ${name}.\n`); });
  vault.command("edit <name>").description("Edit an encrypted vault").action(async (name: string) => edit(await findRepository(), name));
  vault.command("render <name>").description("Render a vault's templates").action(async (name: string) => { const repo = await findRepository(); const files = await renderVault(repo, name); process.stdout.write(`Rendered ${files.length} file${files.length === 1 ? "" : "s"}.\n`); });
  vault.command("check <name>").description("Check a vault's rendered files").action(async (name: string) => { const stale = await checkVault(await findRepository(), name); if (stale.length) { process.stderr.write(`Missing or stale:\n${stale.map((file) => `  ${file}`).join("\n")}\n`); process.exitCode = 1; } else process.stdout.write("Rendered files are current.\n"); });

  program.command("run <name> [command...]").description("Run a command with a vault's environment").allowUnknownOption(true).passThroughOptions().action(async (name: string, command: string[]) => { process.exitCode = await runWithVault(await findRepository(), name, command); });

  const key = program.command("key").description("Manage this repository's age key");
  key.command("generate").description("Generate a repository age key").action(async () => { const result = await generateKey(await findRepository()); process.stdout.write(`Public recipient:\n${result.recipient}\n\nRecovery key (shown once — store it securely):\n${result.identity}\n`); });
  key.command("import").description("Import a repository age key").action(async () => { const repo = await findRepository(); const result = await importKey(repo, await password({ message: "Paste your age private key", mask: "*" })); process.stdout.write(`Imported key for ${result.recipient}.\n`); });

  const user = program.command("user").description("Manage vault access");
  user.command("add").description("Grant a user access to vaults").action(async () => {
    const repo = await findRepository(); const registry = await readRegistry(repo);
    const vaults = [...new Set(registry.users.flatMap((item) => item.vaults))].sort();
    const id = await input({ message: "User ID", validate: (value) => value.trim() ? true : "Enter a user ID" });
    const recipient = await input({ message: "Public age recipient", validate: (value) => /^age1[0-9a-z]+$/.test(value.trim()) ? true : "Enter a native age recipient" });
    const selected = await checkbox({ message: "Vault access", choices: vaults.map((name) => ({ name, value: name })), required: true });
    await addUser(repo, { id: id.trim(), recipient: recipient.trim(), vaults: selected }); process.stdout.write(`Added ${id.trim()}.\n`);
  });
  user.command("remove").description("Remove a user's vault access").action(async () => {
    const repo = await findRepository(); const registry = await readRegistry(repo); const mine = await currentRecipient(repo);
    const candidates = registry.users.filter((item) => item.recipient !== mine);
    if (!candidates.length) throw new Error("There are no other users to remove.");
    const id = await select({ message: "Remove user", choices: candidates.map((item) => ({ name: item.id, value: item.id })) });
    if (!await confirm({ message: `Remove ${id} and rotate affected vault keys?`, default: false })) return;
    await removeUser(repo, id); process.stdout.write(`Removed ${id}. Rotate external provider credentials they knew.\n`);
  });
  return program;
}

export async function main(argv = process.argv): Promise<void> { await createProgram().parseAsync(argv); }

if (import.meta.url === `file://${process.argv[1]}`) main().catch((error: unknown) => { process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });

