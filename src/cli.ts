#!/usr/bin/env node
import { checkbox, confirm, input, password, select } from "@inquirer/prompts";
import { Command } from "commander";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { executeChecked } from "./process.js";
import { findRepository, type Repository } from "./repository.js";
import {
  createIdentity,
  currentIdentity,
  currentRecipient,
  identityFile,
  parseSigningKey,
  readIdentity,
  restoreIdentity,
  type StoredIdentity,
} from "./key.js";
import {
  addGroupMember,
  addGroupManager,
  addUser,
  cleanSecretFiles,
  createGroup,
  createSecretFile,
  deleteGroup,
  diffSecretFiles,
  editSecretFile,
  encryptedFileFor,
  ensureRepositoryMetadata,
  importSecretFile,
  initialize,
  isInitialized,
  materializeSecretFiles,
  readSecretFile,
  removeGroupMember,
  removeGroupManager,
  removeUser,
  registerUser,
  runWithFiles,
  setFileAccess,
  statusSecretFiles,
  stopTrackingPlaintext,
  updateSecretFile,
  type FileAccess,
  type ImportedSecretFile,
} from "./operations.js";
import { normalizeUsername, parseRecipient } from "./recipient.js";
import {
  normalizeGroupName,
  readRegistry,
  usernamesFor,
  type Registry,
} from "./registry.js";
import { currentGroupPolicy } from "./group-policy.js";
import { GitVaultyError, TrackedPlaintextError } from "./errors.js";
import { cleanupAbandonedEditDirectories } from "./edit-temp.js";
import {
  agentSkillStatus,
  installAgentSkill,
} from "./agent-skill.js";
import { readRepositoryConfig } from "./config.js";
import { formatSecretDiff } from "./diff.js";
import { backupKey, type KeyBackupOptions } from "./key-backup.js";

const packageManifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version?: unknown };
if (typeof packageManifest.version !== "string") throw new Error("package.json must contain a version string.");
const packageVersion = packageManifest.version;

async function localUsername(root: string): Promise<string> {
  for (const key of ["user.email", "user.name"]) {
    try {
      const value = (await executeChecked("git", ["config", "--get", key], { cwd: root })).stdout.trim().split("@", 1)[0] ?? "";
      if (value) return normalizeUsername(value);
    } catch { /* prompt fallback */ }
  }
  return "";
}

export function formatUsers(registry: Registry): string {
  if (registry.users.length === 0) return "No users.\n";
  const rows = registry.users
    .map((user) => [
      user.username,
      registry.groups.flatMap((group) => {
        const policy = currentGroupPolicy(group);
        if (!policy.members.some((member) => member.username === user.username)) return [];
        return [policy.managers.includes(user.username) ? `${group.name} (manager)` : group.name];
      }).sort().join(", ") || "—",
    ])
    .sort((left, right) => left[0]!.localeCompare(right[0]!));
  const allRows = [["USERNAME", "GROUPS"], ...rows];
  const width = Math.max(...allRows.map((row) => row[0]!.length));
  return `${allRows.map((row) => `${row[0]!.padEnd(width)}  ${row[1]!}`).join("\n")}\n`;
}

export function formatGroups(registry: Registry): string {
  if (registry.groups.length === 0) return "No groups.\n";
  const rows = registry.groups.map((group) => {
    const policy = currentGroupPolicy(group);
    return [
      group.name === registry.defaultGroup ? `${group.name} (default)` : group.name,
      policy.managers.join(", "),
      policy.members.map((member) => member.username).join(", "),
    ];
  });
  const allRows = [["GROUP", "MANAGERS", "MEMBERS"], ...rows];
  const groupWidth = Math.max(...allRows.map((row) => row[0]!.length));
  const managerWidth = Math.max(...allRows.map((row) => row[1]!.length));
  return `${allRows.map((row) => `${row[0]!.padEnd(groupWidth)}  ${row[1]!.padEnd(managerWidth)}  ${row[2]!}`).join("\n")}\n`;
}

async function hasIdentity(): Promise<boolean> {
  try { await readIdentity(); return true; }
  catch (error) {
    if ((error as Error).message.startsWith("No GitVaulty key found")) return false;
    throw error;
  }
}

type MissingIdentityChoice = "restore" | "create" | "cancel";

function writeIdentityCreated(result: StoredIdentity, write = (message: string) => { process.stderr.write(message); }): void {
  write(`Created global identity at ${identityFile()}.\nAge recipient: ${result.recipient}\nSigning key: ${result.signingKey}\nBack it up with \`gitvaulty key backup\`.\n`);
}

async function ensureCliIdentity(interactive: boolean): Promise<StoredIdentity> {
  if (await hasIdentity()) return currentIdentity();
  if (!interactive) {
    throw new GitVaultyError("A GitVaulty key is required. Run `gitvaulty key restore` or `gitvaulty key create` interactively.");
  }
  const choice = await select<MissingIdentityChoice>({
    message: "No GitVaulty key found",
    choices: [
      { name: "Restore an existing backup", value: "restore" },
      { name: "Create a new key", value: "create" },
      { name: "Cancel", value: "cancel" },
    ],
  }, { output: process.stderr });
  if (choice === "cancel") throw new GitVaultyError("A GitVaulty key is required.");
  if (choice === "restore") {
    const result = await restoreIdentity(
      await password({ message: "Paste your GITVAULTY-IDENTITY backup", mask: "*" }, { output: process.stderr }),
      identityFile(),
    );
    process.stderr.write(`Restored global key for ${result.recipient}.\n`);
    return result;
  }
  const result = await createIdentity();
  writeIdentityCreated(result);
  return result;
}

async function bootstrapUsername(repo: Repository, interactive: boolean): Promise<string> {
  const suggested = await localUsername(repo.root);
  if (!interactive) {
    if (suggested) return suggested;
    throw new GitVaultyError("A GitVaulty username is required. Run a repository command interactively first.");
  }
  return normalizeUsername(await input({
    message: "Your username",
    default: suggested,
    validate: (value) => {
      try { normalizeUsername(value); return true; }
      catch (error) { return (error as Error).message; }
    },
  }, { output: process.stderr }));
}

function systemUsername(environment: NodeJS.ProcessEnv): string {
  for (const value of [environment.USER, environment.USERNAME]) {
    if (!value) continue;
    try { return normalizeUsername(value); }
    catch { /* prompt without an invalid default */ }
  }
  return "";
}

async function registrationUsername(
  positional: string | undefined,
  option: string | undefined,
  interactive: boolean,
  environment: NodeJS.ProcessEnv,
): Promise<string> {
  if (positional && option) {
    throw new GitVaultyError("Choose either the positional username or --username, not both.");
  }
  const explicit = option ?? positional;
  if (explicit) return normalizeUsername(explicit);
  if (!interactive) {
    throw new GitVaultyError("A username is required. Pass --username <username>.");
  }
  const suggested = systemUsername(environment);
  return normalizeUsername(await input({
    message: "Username",
    ...(suggested ? { default: suggested } : {}),
    validate: (value) => {
      try { normalizeUsername(value); return true; }
      catch (error) { return (error as Error).message; }
    },
  }, { output: process.stderr }));
}

function collect(value: string, previous: string[]): string[] { return [...previous, value]; }

function addAccessOptions(command: Command): Command {
  return command
    .option("-g, --group <name>", "group access; repeat for more groups", collect, [])
    .option("-u, --user <username>", "direct user access; repeat for more users", collect, []);
}

type AccessCommandOptions = { group: string[]; user: string[] };
type CatCommandOptions = { force?: boolean };
type DiffCommandOptions = { exitCode?: boolean };
type FileCommandOptions = { file: string[] };
type RunCommandOptions = FileCommandOptions & { all?: boolean };
type ImportCommandOptions = AccessCommandOptions & { update?: boolean };

function accessOptions(options: AccessCommandOptions): { groups: string[]; users: string[] } {
  return { groups: options.group, users: options.user };
}

function runFiles(options: RunCommandOptions): string[] {
  if (options.all && options.file.length > 0) throw new GitVaultyError("Choose either --all or --file, not both.");
  if (!options.all && options.file.length === 0) throw new GitVaultyError("Choose --all or at least one --file.");
  return options.file;
}

type ConfirmTrackedImport = (options: { message: string; default: boolean }) => Promise<boolean>;

export interface AgentSkillPreflightOptions {
  writeNotice?: (message: string) => void;
}

export async function ensureRepositoryAgentSkill(
  repo: Repository,
  options: AgentSkillPreflightOptions = {},
): Promise<void> {
  if ((await readRepositoryConfig(repo)).agentSkill.mode === "disabled") return;
  const status = await agentSkillStatus(repo.root);
  if (status === "current") return;
  const writeNotice = options.writeNotice ?? ((message: string) => { process.stderr.write(message); });
  const result = await installAgentSkill(repo.root, { replace: true });
  writeNotice(`${result === "updated" ? "Updated" : "Installed"} agent skill at .agents/skills/gitvaulty/SKILL.md.\n`);
}

export async function importWithTrackedPrompt(
  repo: Repository,
  requested: string,
  access: FileAccess,
  update = false,
  confirmTracked: ConfirmTrackedImport = confirm,
): Promise<ImportedSecretFile | undefined> {
  const performImport = (): Promise<ImportedSecretFile> => update
    ? updateSecretFile(repo, requested)
    : importSecretFile(repo, requested, access);
  try { return await performImport(); }
  catch (error) {
    if (!(error instanceof TrackedPlaintextError)) throw error;
    process.stderr.write(
      `${error.file} is tracked by Git and may already exist in Git history.\n`
      + "Rotate any exposed credentials even if you continue.\n",
    );
    if (!await confirmTracked({
      message: `Stop tracking ${error.file} and continue importing?`,
      default: false,
    })) {
      process.stderr.write("Import canceled.\n");
      return undefined;
    }
    await stopTrackingPlaintext(repo, error.file);
    process.stderr.write(`Removed ${error.file} from Git's index; the local file was preserved.\n`);
    return performImport();
  }
}

export function createProgram(options: {
  agentSkillPreflight?: (repo: Repository) => Promise<void>;
  environment?: NodeJS.ProcessEnv;
  interactive?: boolean;
  keyBackup?: (options: KeyBackupOptions) => Promise<void>;
} = {}): Command {
  const program = new Command().name("gitvaulty").description("Git-backed secrets for humans.").version(packageVersion).enablePositionalOptions();
  const agentSkillPreflight = options.agentSkillPreflight ?? ensureRepositoryAgentSkill;
  const environment = options.environment ?? process.env;
  const interactive = options.interactive ?? Boolean(process.stdin.isTTY && process.stderr.isTTY);
  const keyBackup = options.keyBackup ?? backupKey;
  const prepareRepository = async (initialUsername?: string): Promise<{ repo: Repository; initialized: boolean }> => {
    const repo = await findRepository();
    const identity = await ensureCliIdentity(interactive);
    let initialized = false;
    if (await isInitialized(repo)) {
      await ensureRepositoryMetadata(repo);
    } else {
      const username = initialUsername ?? await bootstrapUsername(repo, interactive);
      await initialize(repo, {
        username,
        recipient: identity.recipient,
        signingKey: identity.signingKey,
      });
      initialized = true;
      process.stderr.write("GitVaulty initialized.\n");
    }
    await agentSkillPreflight(repo);
    return { repo, initialized };
  };
  const preparedRepository = async (): Promise<Repository> => (await prepareRepository()).repo;

  program.command("init").description("Initialize GitVaulty in this repository").action(async () => {
    await prepareRepository();
    process.stdout.write("GitVaulty is ready.\n");
  });

  addAccessOptions(program.command("create <path>").description("Create an encrypted native file")).action(async (requested: string, options: AccessCommandOptions) => {
    const repo = await preparedRepository();
    const created = await createSecretFile(repo, requested, accessOptions(options));
    await editSecretFile(repo, created.file);
    process.stdout.write(`Created ${created.file}.gitvaulty.\n`);
  });

  addAccessOptions(program.command("import <path>")
    .description("Import an existing plaintext file and keep it locally")
    .option("--update", "replace an existing encrypted file with the current plaintext"))
    .action(async (requested: string, options: ImportCommandOptions) => {
    const repo = await preparedRepository();
    if (options.update && (options.group.length > 0 || options.user.length > 0)) {
      throw new GitVaultyError("Use `gitvaulty access <path>` to change access for an existing file.");
    }
    const imported = await importWithTrackedPrompt(repo, requested, accessOptions(options), options.update);
    if (!imported) return;
    process.stdout.write(`${options.update ? "Updated" : "Imported"} and verified ${imported.file} (${imported.bytes} bytes).\n`);
  });

  addAccessOptions(program.command("access <path>").description("Change who can access an encrypted file")).action(async (requested: string, options: AccessCommandOptions) => {
    const repo = await preparedRepository();
    const registry = await readRegistry(repo);
    const provided = accessOptions(options);
    let groups = provided.groups;
    let users = provided.users;
    if (groups.length === 0 && users.length === 0) {
      const encrypted = path.relative(repo.root, encryptedFileFor(repo, requested)).split(path.sep).join("/");
      const current = registry.files.find((file) => file.path === encrypted);
      if (!current) throw new GitVaultyError(`Unknown encrypted file: ${encrypted}`);
      groups = await checkbox({
        message: "Groups with access",
        choices: registry.groups.map((group) => ({ name: group.name, value: group.name, checked: current.groups.includes(group.name) })),
      });
      users = await checkbox({
        message: "Direct user access (exceptions)",
        choices: registry.users.map((user) => ({ name: user.username, value: user.username, checked: current.users.includes(user.username) })),
      });
    }
    const grant = await setFileAccess(repo, requested, { groups, users });
    const updated = await readRegistry(repo);
    process.stdout.write(`Updated access for ${requested}: ${usernamesFor(updated, grant.path).join(", ")}.\n`);
  });

  program.command("edit <path>").description("Edit an encrypted file by its plaintext path").action(async (file: string) => {
    const repo = await preparedRepository();
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

  program.command("cat <path>")
    .description("Decrypt a file to standard output")
    .option("--force", "allow output to an interactive terminal")
    .action(async (file: string, options: CatCommandOptions) => {
      const repo = await preparedRepository();
      if (process.stdout.isTTY && !options.force) {
        throw new GitVaultyError("Refusing to print a secret to an interactive terminal. Pipe the output or use --force.");
      }
      const opened = await readSecretFile(repo, file);
      process.stdout.write(opened.plaintext);
    });

  program.command("diff [paths...]")
    .description("Show plaintext changes relative to encrypted files")
    .option("--exit-code", "exit with 1 when differences exist")
    .action(async (paths: string[], options: DiffCommandOptions) => {
      const repo = await preparedRepository();
      const differences = await diffSecretFiles(repo, paths);
      for (const difference of differences) {
        process.stdout.write(formatSecretDiff(difference.file, difference.oldContent, difference.newContent));
      }
      if (options.exitCode && differences.length > 0) process.exitCode = 1;
    });

  const addFileOptions = (command: Command): Command => command.option(
    "-f, --file <path>",
    "plaintext path; repeat for more files (defaults to all accessible files)",
    collect,
    [],
  );

  addFileOptions(program.command("materialize").description("Create persistent local plaintext files")).action(async (options: FileCommandOptions) => {
    const repo = await preparedRepository();
    const created = await materializeSecretFiles(repo, options.file);
    process.stdout.write(created.length ? `${created.map((file) => `Materialized ${file}.`).join("\n")}\n` : "All selected files are already materialized.\n");
  });

  addFileOptions(program.command("clean").description("Remove unchanged materialized plaintext files")).action(async (options: FileCommandOptions) => {
    const repo = await preparedRepository();
    const result = await cleanSecretFiles(repo, options.file);
    for (const file of result.removed) process.stdout.write(`Removed ${file}.\n`);
    for (const file of result.retained) process.stderr.write(`Kept ${file.file}: ${file.state}.\n`);
  });

  addFileOptions(program.command("status").description("Show plaintext materialization status")).action(async (options: FileCommandOptions) => {
    const repo = await preparedRepository();
    for (const file of await statusSecretFiles(repo, options.file)) {
      process.stdout.write(`${file.state.padEnd(8)} ${file.file}\n`);
    }
  });

  program.command("run [command...]")
    .description("Materialize encrypted files while a command runs")
    .option("-f, --file <path>", "plaintext path; repeat for more files", collect, [])
    .option("--all", "use every file accessible to the current identity")
    .allowUnknownOption(true)
    .passThroughOptions()
    .action(async (command: string[], options: RunCommandOptions) => {
      const repo = await preparedRepository();
      const files = runFiles(options);
      const result = await runWithFiles(repo, files, command);
      for (const file of result.retained) process.stderr.write(`Warning: ${file} changed while the command ran and was kept.\n`);
      process.exitCode = result.code;
    });

  const key = program.command("key").description("Manage your global age key");
  key.command("create").description("Create a global age key").action(async () => {
    const result = await createIdentity();
    process.stdout.write(`Created global identity at ${identityFile()}.\nAge recipient: ${result.recipient}\nSigning key: ${result.signingKey}\nBack it up with \`gitvaulty key backup\`.\n`);
  });
  key.command("public").description("Print the public GitVaulty identity").action(async () => {
    const identity = await ensureCliIdentity(interactive);
    process.stdout.write(`Age recipient: ${identity.recipient}\nSigning key: ${identity.signingKey}\n`);
  });
  key.command("backup")
    .description("Back up the private GitVaulty key")
    .option("--clipboard", "copy the private key to the system clipboard")
    .option("--print", "print the private key to standard output")
    .action(async (commandOptions: { clipboard?: boolean; print?: boolean }) => {
      const backupOptions = {
        clipboard: Boolean(commandOptions.clipboard),
        interactive,
        print: Boolean(commandOptions.print),
      };
      if (backupOptions.clipboard && backupOptions.print) {
        throw new GitVaultyError("Choose either --clipboard or --print, not both.");
      }
      await ensureCliIdentity(interactive);
      await keyBackup(backupOptions);
    });
  key.command("restore").description("Restore a private key backup").action(async () => {
    const replace = await hasIdentity();
    if (replace && !await confirm({ message: "Replace the existing global GitVaulty key?", default: false })) return;
    const result = await restoreIdentity(await password({ message: "Paste your GITVAULTY-IDENTITY backup", mask: "*" }), identityFile(), replace);
    process.stdout.write(`Restored global key for ${result.recipient}.\n`);
  });

  const user = program.command("user").description("Manage users");
  user.command("register [username]")
    .description("Register your public recipient without granting access")
    .usage("[options]")
    .option("-u, --username <username>", "repository username; prompts when omitted")
    .action(async (username: string | undefined, commandOptions: { username?: string }) => {
      const normalizedUsername = await registrationUsername(
        username,
        commandOptions.username,
        interactive,
        environment,
      );
      const prepared = await prepareRepository(normalizedUsername);
      const { repo } = prepared;
      if (prepared.initialized) {
        process.stdout.write(`Registered ${normalizedUsername} as repository owner in team. Commit .gitvaulty/recipients.json for review.\n`);
        return;
      }
      const identity = await currentIdentity();
      await registerUser(repo, {
        username: normalizedUsername,
        recipient: identity.recipient,
        signingKey: identity.signingKey,
      });
      process.stdout.write(`Registered ${normalizedUsername} with no access. Commit .gitvaulty/recipients.json for review.\n`);
    });
  user.command("add").description("Add a user to groups").action(async () => {
    const repo = await preparedRepository();
    const registry = await readRegistry(repo);
    const publicKey = await input({ message: "Public age recipient", validate: (value) => {
      try { parseRecipient(value); return true; }
      catch (error) { return (error as Error).message; }
    } });
    const recipient = parseRecipient(publicKey);
    const publicSigningKey = await input({ message: "Public Ed25519 signing key", validate: (value) => {
      try { parseSigningKey(value); return true; }
      catch (error) { return (error as Error).message; }
    } });
    const signingKey = parseSigningKey(publicSigningKey);
    const username = await input({ message: "Username", validate: (value) => {
      try { normalizeUsername(value); return true; }
      catch (error) { return (error as Error).message; }
    } });
    const selected = await checkbox({
      message: "Groups",
      choices: registry.groups.map((group) => ({ name: group.name, value: group.name, checked: group.name === registry.defaultGroup })),
      required: true,
    });
    const normalizedUsername = normalizeUsername(username);
    await addUser(repo, { username: normalizedUsername, recipient, signingKey, groups: selected });
    process.stdout.write(`Added ${normalizedUsername}.\n`);
  });
  user.command("list").description("List users and groups").action(async () => {
    process.stdout.write(formatUsers(await readRegistry(await preparedRepository())));
  });
  user.command("remove").description("Remove a user's file access").action(async () => {
    const repo = await preparedRepository();
    const registry = await readRegistry(repo);
    const mine = await currentRecipient();
    const candidates = registry.users.filter((item) => item.recipient !== mine);
    if (candidates.length === 0) throw new Error("There are no other users to remove.");
    const username = await select({ message: "Remove user", choices: candidates.map((item) => ({ name: item.username, value: item.username })) });
    if (!await confirm({ message: `Remove ${username} and rotate affected file keys?`, default: false })) return;
    await removeUser(repo, username);
    process.stdout.write(`Removed ${username}. Rotate external provider credentials they knew.\n`);
  });

  const group = program.command("group").description("Manage access groups");
  group.command("create <name>").description("Create a group").action(async (name: string) => {
    const repo = await preparedRepository();
    const normalized = normalizeGroupName(name);
    await createGroup(repo, normalized);
    const identity = await currentIdentity();
    const registry = await readRegistry(repo);
    const creator = registry.users.find((user) => user.recipient === identity.recipient)!;
    process.stdout.write(`Created group ${normalized}; ${creator.username} is its manager and member.\n`);
  });
  group.command("add <group> <username>").description("Add a user to a group").action(async (name: string, username: string) => {
    const repo = await preparedRepository();
    await addGroupMember(repo, name, username);
    process.stdout.write(`Added ${normalizeUsername(username)} to ${normalizeGroupName(name)}.\n`);
  });
  group.command("remove <group> <username>").description("Remove a user from a group and rotate affected files").action(async (name: string, username: string) => {
    const repo = await preparedRepository();
    await removeGroupMember(repo, name, username);
    process.stdout.write(`Removed ${normalizeUsername(username)} from ${normalizeGroupName(name)}.\n`);
  });
  const manager = group.command("manager").description("Manage group managers");
  manager.command("add <group> <username>").description("Promote a group member to manager").action(async (name: string, username: string) => {
    const repo = await preparedRepository();
    await addGroupManager(repo, name, username);
    process.stdout.write(`Promoted ${normalizeUsername(username)} to manager of ${normalizeGroupName(name)}.\n`);
  });
  manager.command("remove <group> <username>").description("Demote a group manager but keep membership").action(async (name: string, username: string) => {
    const repo = await preparedRepository();
    await removeGroupManager(repo, name, username);
    process.stdout.write(`Demoted ${normalizeUsername(username)} from manager of ${normalizeGroupName(name)}.\n`);
  });
  group.command("list").description("List groups and members").action(async () => {
    process.stdout.write(formatGroups(await readRegistry(await preparedRepository())));
  });
  group.command("delete <name>").description("Delete an unused group").action(async (name: string) => {
    const repo = await preparedRepository();
    await deleteGroup(repo, name);
    process.stdout.write(`Deleted group ${normalizeGroupName(name)}.\n`);
  });
  return program;
}

export async function main(
  argv = process.argv,
  cleanup: () => Promise<unknown> = cleanupAbandonedEditDirectories,
  program = createProgram(),
): Promise<void> {
  await cleanup().catch(() => undefined);
  await program.parseAsync(argv);
}

export function isMainModule(moduleUrl: string, argvPath: string | undefined): boolean {
  if (!argvPath) return false;
  try { return realpathSync(fileURLToPath(moduleUrl)) === realpathSync(argvPath); }
  catch { return false; }
}

if (isMainModule(import.meta.url, process.argv[1])) main().catch((error: unknown) => {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
