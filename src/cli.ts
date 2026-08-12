#!/usr/bin/env node
import { checkbox, confirm, input, password, select } from "@inquirer/prompts";
import { Command } from "commander";
import { executeChecked } from "./process.js";
import { findRepository } from "./repository.js";
import { createIdentity, currentRecipient, identityFile, readIdentity, restoreIdentity } from "./key.js";
import {
  addUser,
  cleanSecretFiles,
  createSecretFile,
  editSecretFile,
  importSecretFile,
  initialize,
  materializeSecretFiles,
  removeUser,
  runWithFiles,
  statusSecretFiles,
  updateSecretFile,
} from "./operations.js";
import { normalizeUsername, parseRecipient } from "./recipient.js";
import { readRegistry, type GitVaultyUser } from "./registry.js";
import { GitVaultyError } from "./errors.js";

async function localUsername(root: string): Promise<string> {
  for (const key of ["user.email", "user.name"]) {
    try {
      const value = (await executeChecked("git", ["config", "--get", key], { cwd: root })).stdout.trim().split("@", 1)[0] ?? "";
      if (value) return normalizeUsername(value);
    } catch { /* prompt fallback */ }
  }
  return "";
}

export function formatUsers(users: GitVaultyUser[]): string {
  if (users.length === 0) return "No users.\n";
  const rows = users
    .map((user) => [user.username, [...user.files].sort().map((file) => file.slice(0, -".gitvaulty".length)).join(", ")])
    .sort((left, right) => left[0]!.localeCompare(right[0]!));
  const allRows = [["USERNAME", "FILES"], ...rows];
  const width = Math.max(...allRows.map((row) => row[0]!.length));
  return `${allRows.map((row) => `${row[0]!.padEnd(width)}  ${row[1]!}`).join("\n")}\n`;
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

function collect(value: string, previous: string[]): string[] { return [...previous, value]; }

export function createProgram(): Command {
  const program = new Command().name("gitvaulty").description("Git-backed secrets for humans.").version("0.1.0").enablePositionalOptions();

  program.command("init").description("Initialize GitVaulty in this repository").action(async () => {
    const repo = await findRepository();
    const recipient = await ensureCliIdentity();
    const username = await input({ message: "Your username", default: await localUsername(repo.root), validate: (value) => {
      try { normalizeUsername(value); return true; }
      catch (error) { return (error as Error).message; }
    } });
    await initialize(repo, { username: normalizeUsername(username), recipient });
    process.stdout.write("GitVaulty initialized.\n");
  });

  program.command("create <path>").description("Create an encrypted native file").action(async (requested: string) => {
    await ensureCliIdentity();
    const repo = await findRepository();
    const created = await createSecretFile(repo, requested);
    await editSecretFile(repo, created.file);
    process.stdout.write(`Created ${created.file}.gitvaulty.\n`);
  });

  program.command("import <path>")
    .description("Import an existing plaintext file without removing it")
    .option("--update", "replace an existing encrypted file with the current plaintext")
    .action(async (requested: string, action: Command) => {
    await ensureCliIdentity();
    const repo = await findRepository();
    const imported = action.opts<{ update?: boolean }>().update
      ? await updateSecretFile(repo, requested)
      : await importSecretFile(repo, requested);
    process.stdout.write(`${action.opts<{ update?: boolean }>().update ? "Updated" : "Imported"} and verified ${imported.file} (${imported.bytes} bytes).\n`);
  });

  program.command("edit <path>").description("Edit an encrypted file by its plaintext path").action(async (file: string) => {
    await ensureCliIdentity();
    const repo = await findRepository();
    const [status] = await statusSecretFiles(repo, [file]);
    let resolution: "error" | "use-local" | "discard-local" = "error";
    if (status?.state === "modified") {
      resolution = await select({
        message: `${file} has local changes`,
        choices: [
          { name: "Use local changes, then edit", value: "use-local" as const },
          { name: "Discard local changes, then edit", value: "discard-local" as const },
          { name: "Cancel", value: "error" as const },
        ],
      });
      if (resolution === "error") return;
    }
    const changed = await editSecretFile(repo, file, resolution);
    process.stdout.write(changed ? `Updated ${file}.gitvaulty.\n` : `No changes to ${file}.\n`);
  });

  const addFileOptions = (command: Command): Command => command.option(
    "-f, --file <path>",
    "plaintext path; repeat for more files (defaults to all accessible files)",
    collect,
    [],
  );

  addFileOptions(program.command("materialize").description("Create persistent local plaintext files")).action(async (action: Command) => {
    await ensureCliIdentity();
    const created = await materializeSecretFiles(await findRepository(), action.opts<{ file: string[] }>().file);
    process.stdout.write(created.length ? `${created.map((file) => `Materialized ${file}.`).join("\n")}\n` : "All selected files are already materialized.\n");
  });

  addFileOptions(program.command("clean").description("Remove unchanged materialized plaintext files")).action(async (action: Command) => {
    await ensureCliIdentity();
    const result = await cleanSecretFiles(await findRepository(), action.opts<{ file: string[] }>().file);
    for (const file of result.removed) process.stdout.write(`Removed ${file}.\n`);
    for (const file of result.retained) process.stderr.write(`Kept ${file.file}: ${file.state}.\n`);
  });

  addFileOptions(program.command("status").description("Show plaintext materialization status")).action(async (action: Command) => {
    await ensureCliIdentity();
    for (const file of await statusSecretFiles(await findRepository(), action.opts<{ file: string[] }>().file)) {
      process.stdout.write(`${file.state.padEnd(8)} ${file.file}\n`);
    }
  });

  addFileOptions(program.command("run [command...]")
    .description("Materialize encrypted files while a command runs")
    .allowUnknownOption(true)
    .passThroughOptions())
    .action(async (command: string[], action: Command) => {
      await ensureCliIdentity();
      const files = action.opts<{ file: string[] }>().file;
      const result = await runWithFiles(await findRepository(), files, command);
      for (const file of result.retained) process.stderr.write(`Warning: ${file} changed while the command ran and was kept.\n`);
      process.exitCode = result.code;
    });

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

  const user = program.command("user").description("Manage file access");
  user.command("add").description("Grant a user access to encrypted files").action(async () => {
    await ensureCliIdentity();
    const repo = await findRepository();
    const registry = await readRegistry(repo);
    const files = [...new Set(registry.users.flatMap((item) => item.files))].sort();
    if (files.length === 0) throw new GitVaultyError("Create an encrypted file before adding another user.");
    const publicKey = await input({ message: "Public age recipient", validate: (value) => {
      try { parseRecipient(value); return true; }
      catch (error) { return (error as Error).message; }
    } });
    const recipient = parseRecipient(publicKey);
    const username = await input({ message: "Username", validate: (value) => {
      try { normalizeUsername(value); return true; }
      catch (error) { return (error as Error).message; }
    } });
    const selected = await checkbox({
      message: "File access",
      choices: files.map((file) => ({ name: file.slice(0, -".gitvaulty".length), value: file })),
      required: true,
    });
    const normalizedUsername = normalizeUsername(username);
    await addUser(repo, { username: normalizedUsername, recipient, files: selected });
    process.stdout.write(`Added ${normalizedUsername}.\n`);
  });
  user.command("list").description("List users and file access").action(async () => {
    process.stdout.write(formatUsers((await readRegistry(await findRepository())).users));
  });
  user.command("remove").description("Remove a user's file access").action(async () => {
    await ensureCliIdentity();
    const repo = await findRepository();
    const registry = await readRegistry(repo);
    const mine = await currentRecipient();
    const candidates = registry.users.filter((item) => item.recipient !== mine);
    if (candidates.length === 0) throw new Error("There are no other users to remove.");
    const username = await select({ message: "Remove user", choices: candidates.map((item) => ({ name: item.username, value: item.username })) });
    if (!await confirm({ message: `Remove ${username} and rotate affected file keys?`, default: false })) return;
    await removeUser(repo, username);
    process.stdout.write(`Removed ${username}. Rotate external provider credentials they knew.\n`);
  });
  return program;
}

export async function main(argv = process.argv): Promise<void> { await createProgram().parseAsync(argv); }

if (import.meta.url === `file://${process.argv[1]}`) main().catch((error: unknown) => {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
