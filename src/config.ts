import path from "node:path";
import { chmod, readFile, rename, rm, writeFile } from "node:fs/promises";
import { Document, parseDocument } from "yaml";

import { GitVaultyError } from "./errors.js";
import type { Repository } from "./repository.js";
import { ensureParent } from "./repository.js";

export type AgentSkillMode = "managed" | "disabled";

export interface RepositoryConfig {
  version: 1;
  agentSkill: { mode: AgentSkillMode };
}

const DEFAULT_CONFIG: RepositoryConfig = {
  version: 1,
  agentSkill: { mode: "managed" },
};

type ConfigDocument = ReturnType<typeof parseDocument>;

function invalidConfig(): GitVaultyError {
  return new GitVaultyError("Unsupported GitVaulty configuration format.");
}

function normalizeConfig(value: unknown): RepositoryConfig {
  if (!value || typeof value !== "object" || (value as { version?: unknown }).version !== 1) {
    throw invalidConfig();
  }
  const agentSkill = (value as { agentSkill?: unknown }).agentSkill;
  if (agentSkill === undefined) return structuredClone(DEFAULT_CONFIG);
  if (!agentSkill || typeof agentSkill !== "object") throw invalidConfig();
  const mode = (agentSkill as { mode?: unknown }).mode;
  if (mode !== "managed" && mode !== "disabled") throw invalidConfig();
  return { version: 1, agentSkill: { mode } };
}

function parseConfig(source: string): { document: ConfigDocument; config: RepositoryConfig } {
  const document = parseDocument(source, { uniqueKeys: true });
  if (document.errors.length > 0) throw invalidConfig();
  let value: unknown;
  try { value = document.toJS(); }
  catch { throw invalidConfig(); }
  return { document, config: normalizeConfig(value) };
}

async function loadConfigDocument(repo: Repository): Promise<{ document: ConfigDocument; config: RepositoryConfig; exists: boolean }> {
  try {
    const parsed = parseConfig(await readFile(repo.configFile, "utf8"));
    return { ...parsed, exists: true };
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return {
      document: new Document(structuredClone(DEFAULT_CONFIG)) as ConfigDocument,
      config: structuredClone(DEFAULT_CONFIG),
      exists: false,
    };
  }
}

async function atomicWrite(file: string, contents: string): Promise<void> {
  await ensureParent(file);
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  try {
    await writeFile(temporary, contents, { encoding: "utf8", mode: 0o644, flag: "wx" });
    await rename(temporary, file);
    await chmod(file, 0o644);
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function readRepositoryConfig(repo: Repository): Promise<RepositoryConfig> {
  return (await loadConfigDocument(repo)).config;
}

export async function ensureRepositoryConfig(repo: Repository): Promise<void> {
  const loaded = await loadConfigDocument(repo);
  if (!loaded.exists) await atomicWrite(repo.configFile, loaded.document.toString({ lineWidth: 0 }));
}

export async function writeAgentSkillMode(repo: Repository, mode: AgentSkillMode): Promise<void> {
  const loaded = await loadConfigDocument(repo);
  loaded.document.setIn(["agentSkill", "mode"], mode);
  await atomicWrite(repo.configFile, loaded.document.toString({ lineWidth: 0 }));
}
