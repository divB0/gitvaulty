import path from "node:path";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { GitVaultyError } from "./errors.js";

export const AGENT_SKILL_RELATIVE_FILE = path.join(
  ".agents",
  "skills",
  "gitvaulty",
  "SKILL.md",
);

export type AgentSkillInstallResult = "installed" | "preserved";

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

async function existingSkill(file: string): Promise<boolean> {
  try {
    const entry = await lstat(file);
    if (entry.isSymbolicLink() || !entry.isFile()) {
      throw new GitVaultyError(`Existing agent skill must be a regular file: ${file}`);
    }
    return true;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function installAgentSkill(repositoryRoot: string): Promise<AgentSkillInstallResult> {
  const skillFile = path.join(repositoryRoot, AGENT_SKILL_RELATIVE_FILE);
  if (await existingSkill(skillFile)) return "preserved";

  let directory = repositoryRoot;
  for (const segment of [".agents", "skills", "gitvaulty"]) {
    directory = path.join(directory, segment);
    await ensureDirectory(directory);
  }

  const template = await readFile(new URL("../skills/gitvaulty/SKILL.md", import.meta.url), "utf8");
  try {
    await writeFile(skillFile, template, { encoding: "utf8", mode: 0o644, flag: "wx" });
    return "installed";
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    if (await existingSkill(skillFile)) return "preserved";
    throw error;
  }
}
