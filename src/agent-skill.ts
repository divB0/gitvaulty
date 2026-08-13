import { createHash } from "node:crypto";
import path from "node:path";
import { chmod, lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { GitVaultyError } from "./errors.js";

export const AGENT_SKILL_RELATIVE_FILE = path.join(
  ".agents",
  "skills",
  "gitvaulty",
  "SKILL.md",
);

export type AgentSkillStatus = "missing" | "current" | "different";
export type AgentSkillInstallResult = "installed" | "updated" | "current" | "preserved";

async function ensureDirectory(directory: string): Promise<void> {
  try { await mkdir(directory, { mode: 0o755 }); }
  catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const entry = await lstat(directory);
  if (entry.isSymbolicLink() || !entry.isDirectory()) {
    throw new GitVaultyError(`Agent skill path must contain only directories: ${directory}`);
  }
}

async function readExistingSkill(file: string): Promise<string | undefined> {
  try {
    const entry = await lstat(file);
    if (entry.isSymbolicLink() || !entry.isFile()) {
      throw new GitVaultyError(`Existing agent skill must be a regular file: ${file}`);
    }
    return readFile(file, "utf8");
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function digest(contents: string): string {
  return createHash("sha256").update(contents.replace(/\r\n?/g, "\n"), "utf8").digest("hex");
}

async function bundledSkill(): Promise<string> {
  return readFile(new URL("../skills/gitvaulty/SKILL.md", import.meta.url), "utf8");
}

function statusFor(existing: string | undefined, bundled: string): AgentSkillStatus {
  if (existing === undefined) return "missing";
  return digest(existing) === digest(bundled) ? "current" : "different";
}

export async function agentSkillStatus(repositoryRoot: string): Promise<AgentSkillStatus> {
  const existing = await readExistingSkill(path.join(repositoryRoot, AGENT_SKILL_RELATIVE_FILE));
  return statusFor(existing, await bundledSkill());
}

export async function installAgentSkill(
  repositoryRoot: string,
  options: { replace?: boolean } = {},
): Promise<AgentSkillInstallResult> {
  const skillFile = path.join(repositoryRoot, AGENT_SKILL_RELATIVE_FILE);
  const template = await bundledSkill();
  const existing = await readExistingSkill(skillFile);
  const status = statusFor(existing, template);
  if (status === "current") return "current";
  if (status === "different" && !options.replace) return "preserved";

  let directory = repositoryRoot;
  for (const segment of [".agents", "skills", "gitvaulty"]) {
    directory = path.join(directory, segment);
    await ensureDirectory(directory);
  }

  const temporary = path.join(directory, `.SKILL.md.${process.pid}.${Date.now()}.tmp`);
  try {
    await writeFile(temporary, template, { encoding: "utf8", mode: 0o644, flag: "wx" });
    const latest = await readExistingSkill(skillFile);
    if (latest !== existing) throw new GitVaultyError(`Agent skill changed while it was being updated: ${skillFile}`);
    await rename(temporary, skillFile);
    await chmod(skillFile, 0o644);
    return status === "missing" ? "installed" : "updated";
  } finally {
    await rm(temporary, { force: true });
  }
}
