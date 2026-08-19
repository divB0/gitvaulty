import { confirm, select } from "@inquirer/prompts";
import clipboard from "clipboardy";

import { GitVaultyError } from "./errors.js";
import { readIdentity } from "./key.js";
import {
  execute,
  executeInteractiveCapture,
  type ProcessOptions,
  type ProcessResult,
} from "./process.js";

type Destination = "password-manager" | "clipboard" | "print" | "cancel";
type Provider = "onepassword" | "bitwarden";
type Navigation = "recheck" | "back";

type SelectPrompt = (
  prompt: { message: string; choices: Array<{ name: string; value: string }> },
  context?: { output?: NodeJS.WriteStream },
) => Promise<string>;

type ConfirmPrompt = (
  prompt: { message: string; default: boolean },
  context?: { output?: NodeJS.WriteStream },
) => Promise<boolean>;

type ProcessExecutor = (
  command: string,
  args: string[],
  options?: ProcessOptions,
) => Promise<ProcessResult>;

export interface KeyBackupOptions {
  clipboard?: boolean;
  interactive: boolean;
  print?: boolean;
}

export interface KeyBackupDependencies {
  confirm: ConfirmPrompt;
  environment: NodeJS.ProcessEnv;
  execute: ProcessExecutor;
  executeInteractive: ProcessExecutor;
  readIdentity: () => Promise<string>;
  select: SelectPrompt;
  writeClipboard: (value: string) => Promise<void>;
  writeStderr: (value: string) => void;
  writeStdout: (value: string) => void;
}

const defaultDependencies: KeyBackupDependencies = {
  confirm: confirm as ConfirmPrompt,
  environment: process.env,
  execute,
  executeInteractive: executeInteractiveCapture,
  readIdentity,
  select: select as SelectPrompt,
  writeClipboard: (value) => clipboard.write(value),
  writeStderr: (value) => { process.stderr.write(value); },
  writeStdout: (value) => { process.stdout.write(value); },
};

interface ProviderDetection { detected: boolean; provider: Provider }

const providerCommands: Record<Provider, string> = {
  bitwarden: "bw",
  onepassword: "op",
};

const providerLabels: Record<Provider, string> = {
  bitwarden: "Bitwarden",
  onepassword: "1Password",
};

async function detectProvider(provider: Provider, deps: KeyBackupDependencies): Promise<ProviderDetection> {
  try {
    const result = await deps.execute(providerCommands[provider], ["--version"]);
    return { detected: result.code === 0, provider };
  } catch {
    return { detected: false, provider };
  }
}

function providerFailure(provider: Provider, result: ProcessResult, secret?: string): GitVaultyError {
  const label = providerLabels[provider];
  const detail = result.stderr.trim();
  const redacted = secret ? detail.replaceAll(secret, "[redacted]") : detail;
  return new GitVaultyError(redacted ? `${label} could not save the backup: ${redacted}` : `${label} could not save the backup.`);
}

function installationGuidance(provider: Provider): string {
  if (provider === "onepassword") {
    return [
      "1Password CLI was not found.",
      "Install the `op` CLI and add it to PATH:",
      "https://developer.1password.com/docs/cli/get-started/",
      "",
    ].join("\n");
  }
  return [
    "Bitwarden CLI was not found.",
    "Install the `bw` CLI and add it to PATH:",
    "npm install --global @bitwarden/cli",
    "https://bitwarden.com/help/cli/",
    "",
  ].join("\n");
}

async function nextAfterGuidance(message: string, deps: KeyBackupDependencies): Promise<Navigation> {
  deps.writeStderr(message);
  return await deps.select({
    message: "Next",
    choices: [
      { name: "Check again", value: "recheck" },
      { name: "Back", value: "back" },
    ],
  }, { output: process.stderr }) as Navigation;
}

function parseJsonObject(value: string, message: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    return parsed as Record<string, unknown>;
  } catch {
    throw new GitVaultyError(message);
  }
}

async function saveToOnePassword(secret: string, deps: KeyBackupDependencies): Promise<void> {
  const templateResult = await deps.execute("op", ["item", "template", "get", "Password"]);
  if (templateResult.code !== 0) throw providerFailure("onepassword", templateResult, secret);
  const template = parseJsonObject(templateResult.stdout, "1Password returned an invalid Password item template.");
  if (!Array.isArray(template.fields)) throw new GitVaultyError("1Password returned an invalid Password item template.");
  const passwordField = template.fields.find((field) => {
    if (!field || typeof field !== "object") return false;
    const candidate = field as { id?: unknown; label?: unknown };
    return candidate.id === "password" || (typeof candidate.label === "string" && candidate.label.toLowerCase() === "password");
  }) as Record<string, unknown> | undefined;
  if (!passwordField) throw new GitVaultyError("1Password returned a Password item template without a password field.");
  template.title = "GitVaulty recovery key";
  passwordField.value = secret;
  const createResult = await deps.execute("op", ["item", "create", "-", "--title", "GitVaulty recovery key"], {
    input: JSON.stringify(template),
  });
  if (createResult.code !== 0) throw providerFailure("onepassword", createResult, secret);
  deps.writeStderr("Saved the private GitVaulty key in 1Password.\n");
}

type BitwardenStatus = "locked" | "unauthenticated" | "unlocked";

async function bitwardenStatus(deps: KeyBackupDependencies): Promise<BitwardenStatus> {
  const result = await deps.execute("bw", ["status"]);
  if (result.code !== 0) throw providerFailure("bitwarden", result);
  const status = parseJsonObject(result.stdout, "Bitwarden returned an invalid status response.").status;
  if (status !== "locked" && status !== "unauthenticated" && status !== "unlocked") {
    throw new GitVaultyError("Bitwarden returned an unknown vault status.");
  }
  return status;
}

async function saveToBitwarden(secret: string, status: BitwardenStatus, deps: KeyBackupDependencies): Promise<void> {
  let ownedSession: string | undefined;
  let environment = deps.environment;
  try {
    if (status === "locked") {
      const unlocked = await deps.executeInteractive("bw", ["unlock", "--raw"], { env: deps.environment });
      if (unlocked.code !== 0 || !unlocked.stdout.trim()) throw providerFailure("bitwarden", unlocked);
      ownedSession = unlocked.stdout.trim();
      environment = { ...deps.environment, BW_SESSION: ownedSession };
    }
    const item = {
      name: "GitVaulty recovery key",
      notes: secret,
      secureNote: { type: 0 },
      type: 2,
    };
    const encoded = Buffer.from(JSON.stringify(item), "utf8").toString("base64");
    const created = await deps.execute("bw", ["create", "item"], { env: environment, input: encoded });
    if (created.code !== 0) throw providerFailure("bitwarden", created, secret);
    deps.writeStderr("Saved the private GitVaulty key in Bitwarden.\n");
  } finally {
    if (ownedSession) {
      const locked = await deps.execute("bw", ["lock"], { env: environment });
      if (locked.code !== 0) deps.writeStderr("Warning: Bitwarden saved the backup but its temporary session could not be locked. Run `bw lock`.\n");
      ownedSession = undefined;
    }
  }
}

async function choosePasswordManager(deps: KeyBackupDependencies): Promise<"back" | "saved"> {
  while (true) {
    const detections = await Promise.all([
      detectProvider("onepassword", deps),
      detectProvider("bitwarden", deps),
    ]);
    const detected = new Map(detections.map((item) => [item.provider, item.detected]));
    const provider = await deps.select({
      message: "Choose a password manager",
      choices: [
        {
          name: `1Password  ${detected.get("onepassword") ? "✓ Detected" : "○ CLI not found"}`,
          value: "onepassword",
        },
        {
          name: `Bitwarden  ${detected.get("bitwarden") ? "✓ Detected" : "○ CLI not found"}`,
          value: "bitwarden",
        },
        { name: "Back", value: "back" },
      ],
    }, { output: process.stderr }) as Provider | "back";
    if (provider === "back") return "back";
    if (!detected.get(provider)) {
      if (await nextAfterGuidance(installationGuidance(provider), deps) === "recheck") continue;
      continue;
    }

    if (provider === "bitwarden") {
      const status = await bitwardenStatus(deps);
      if (status === "unauthenticated") {
        const action = await nextAfterGuidance(
          "Bitwarden is not signed in. Run `bw login`, then check again.\n",
          deps,
        );
        if (action === "recheck") continue;
        continue;
      }
      if (!await deps.confirm({ message: "Save the private GitVaulty key in Bitwarden?", default: false }, { output: process.stderr })) continue;
      const secret = await deps.readIdentity();
      await saveToBitwarden(secret, status, deps);
      return "saved";
    }

    if (!await deps.confirm({ message: "Save the private GitVaulty key in 1Password?", default: false }, { output: process.stderr })) continue;
    const secret = await deps.readIdentity();
    await saveToOnePassword(secret, deps);
    return "saved";
  }
}

async function copyToClipboard(deps: KeyBackupDependencies): Promise<void> {
  const secret = await deps.readIdentity();
  try {
    await deps.writeClipboard(secret);
  } catch {
    throw new GitVaultyError("The system clipboard is unavailable. Use `gitvaulty key backup --print` or run the command in a desktop session.");
  }
  deps.writeStderr("Private GitVaulty key copied to the clipboard.\n");
}

async function printIdentity(deps: KeyBackupDependencies): Promise<void> {
  deps.writeStdout(`${await deps.readIdentity()}\n`);
}

export async function backupKey(
  options: KeyBackupOptions,
  dependencies: KeyBackupDependencies = defaultDependencies,
): Promise<void> {
  if (options.clipboard && options.print) throw new GitVaultyError("Choose either --clipboard or --print, not both.");
  if (options.clipboard) return copyToClipboard(dependencies);
  if (options.print) return printIdentity(dependencies);
  if (!options.interactive) {
    throw new GitVaultyError("An interactive terminal is required. Use --clipboard or --print to choose a backup destination.");
  }

  while (true) {
    const destination = await dependencies.select({
      message: "Where should GitVaulty save the backup?",
      choices: [
        { name: "Password manager", value: "password-manager" },
        { name: "Clipboard", value: "clipboard" },
        { name: "Print to terminal", value: "print" },
        { name: "Cancel", value: "cancel" },
      ],
    }, { output: process.stderr }) as Destination;
    if (destination === "cancel") return;
    if (destination === "clipboard") return copyToClipboard(dependencies);
    if (destination === "print") {
      if (!await dependencies.confirm({ message: "Print your private GitVaulty key? Keep it secret.", default: false }, { output: process.stderr })) continue;
      return printIdentity(dependencies);
    }
    if (await choosePasswordManager(dependencies) === "saved") return;
  }
}
