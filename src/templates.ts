import path from "node:path";
import { chmod, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import type { Repository } from "./repository.js";
import { ensureParent, validateName } from "./repository.js";
import { GitVaultyError } from "./errors.js";
import { decryptVault } from "./sops.js";

function lookup(data: unknown, key: string): unknown {
  let value = data;
  for (const part of key.split(".")) {
    if (!value || typeof value !== "object" || !(part in value)) throw new GitVaultyError(`Template value not found: ${key}`);
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}

export function renderTemplate(template: string, data: unknown): string {
  return template.replace(/{{\s*(?:(json)\s+)?([a-zA-Z0-9_.-]+)\s*}}/g, (_all, json: string | undefined, key: string) => {
    const value = lookup(data, key);
    if (json) return JSON.stringify(value);
    if (value === null || typeof value === "object") throw new GitVaultyError(`Template value ${key} requires the json helper.`);
    return String(value);
  });
}

async function filesBelow(directory: string): Promise<string[]> {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const found: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await filesBelow(full));
    else if (entry.isFile() && entry.name.endsWith(".tpl")) found.push(full);
  }
  return found;
}

export interface RenderedFile { template: string; output: string; content: string }

export async function renderInMemory(repo: Repository, name: string): Promise<RenderedFile[]> {
  validateName(name);
  const vaultDir = path.join(repo.vaultsDir, name);
  let data: unknown;
  try { data = JSON.parse(await decryptVault(repo, path.join(vaultDir, "vault.sops.json"))); }
  catch (error) { if (error instanceof SyntaxError) throw new GitVaultyError("Decrypted vault is not valid JSON."); throw error; }
  const templateDir = path.join(vaultDir, "templates");
  const templates = await filesBelow(templateDir);
  return Promise.all(templates.map(async (template) => {
    const relative = path.relative(templateDir, template).slice(0, -4);
    const output = path.resolve(repo.root, relative);
    if (output !== repo.root && !output.startsWith(`${repo.root}${path.sep}`)) throw new GitVaultyError(`Template escapes repository: ${relative}`);
    return { template, output, content: renderTemplate(await readFile(template, "utf8"), data) };
  }));
}

async function exclude(repo: Repository, output: string): Promise<void> {
  await ensureParent(repo.excludeFile);
  let lines: string[] = [];
  try { lines = (await readFile(repo.excludeFile, "utf8")).split(/\r?\n/); } catch { /* new Git repo */ }
  const relative = `/${path.relative(repo.root, output).split(path.sep).join("/")}`;
  if (!lines.includes(relative)) await writeFile(repo.excludeFile, `${lines.filter(Boolean).join("\n")}${lines.some(Boolean) ? "\n" : ""}${relative}\n`);
}

export async function renderVault(repo: Repository, name: string): Promise<RenderedFile[]> {
  const rendered = await renderInMemory(repo, name);
  for (const item of rendered) {
    await ensureParent(item.output);
    const temporary = path.join(path.dirname(item.output), `.${path.basename(item.output)}.${process.pid}.tmp`);
    await writeFile(temporary, item.content, { mode: 0o600 });
    await rename(temporary, item.output);
    await chmod(item.output, 0o600);
    await exclude(repo, item.output);
  }
  return rendered;
}

export async function checkVault(repo: Repository, name: string): Promise<string[]> {
  const stale: string[] = [];
  for (const item of await renderInMemory(repo, name)) {
    try { if (await readFile(item.output, "utf8") !== item.content) stale.push(path.relative(repo.root, item.output)); }
    catch { stale.push(path.relative(repo.root, item.output)); }
  }
  return stale;
}

export async function ensureTemplateDirectory(repo: Repository, name: string): Promise<void> {
  await mkdir(path.join(repo.vaultsDir, validateName(name), "templates"), { recursive: true });
}

