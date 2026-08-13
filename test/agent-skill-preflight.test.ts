import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { installAgentSkill } from "../src/agent-skill.js";
import { ensureRepositoryAgentSkill } from "../src/cli.js";
import { ensureRepositoryConfig, readRepositoryConfig } from "../src/config.js";
import { executeChecked } from "../src/process.js";
import { findRepository, type Repository } from "../src/repository.js";

describe("repository agent skill preflight", () => {
  let repo: Repository;
  let output: string[];
  let warnings: string[];

  beforeEach(async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-agent-preflight-"));
    await executeChecked("git", ["init", "-q"], { cwd: root });
    repo = await findRepository(root);
    await ensureRepositoryConfig(repo);
    output = [];
    warnings = [];
  });

  const options = (decide: (status: "missing" | "different") => Promise<"install" | "skip" | "disable">) => ({
    interactive: true,
    decide,
    writeOutput: (message: string) => { output.push(message); },
    writeWarning: (message: string) => { warnings.push(message); },
  });

  it("installs a missing skill after explicit approval", async () => {
    const decide = vi.fn(async () => "install" as const);

    await ensureRepositoryAgentSkill(repo, options(decide));

    expect(decide).toHaveBeenCalledWith("missing");
    expect(await readFile(path.join(repo.root, ".agents", "skills", "gitvaulty", "SKILL.md"), "utf8"))
      .toContain("name: gitvaulty");
    expect(output.join("")).toContain("Installed agent skill");
  });

  it("replaces differing content after explicit approval", async () => {
    const skillFile = path.join(repo.root, ".agents", "skills", "gitvaulty", "SKILL.md");
    await installAgentSkill(repo.root);
    await writeFile(skillFile, "custom instructions\n");

    await ensureRepositoryAgentSkill(repo, options(async () => "install"));

    expect(await readFile(skillFile, "utf8")).toContain("name: gitvaulty");
    expect(output.join("")).toContain("Updated agent skill");
  });

  it("skips once without changing the repository", async () => {
    await ensureRepositoryAgentSkill(repo, options(async () => "skip"));

    await expect(access(path.join(repo.root, ".agents", "skills", "gitvaulty", "SKILL.md")))
      .rejects.toMatchObject({ code: "ENOENT" });
    await expect(readRepositoryConfig(repo)).resolves.toEqual({
      version: 1,
      agentSkill: { mode: "managed" },
    });
  });

  it("stores a repository-wide opt-out and suppresses future checks", async () => {
    await ensureRepositoryAgentSkill(repo, options(async () => "disable"));
    const decide = vi.fn(async () => "install" as const);
    await ensureRepositoryAgentSkill(repo, options(decide));

    await expect(readRepositoryConfig(repo)).resolves.toEqual({
      version: 1,
      agentSkill: { mode: "disabled" },
    });
    expect(decide).not.toHaveBeenCalled();
    expect(output.join("")).toContain("Commit .gitvaulty/config.yaml");
  });

  it("warns and continues without prompting when non-interactive", async () => {
    const decide = vi.fn(async () => "install" as const);

    await ensureRepositoryAgentSkill(repo, {
      ...options(decide),
      interactive: false,
    });

    expect(decide).not.toHaveBeenCalled();
    expect(warnings.join("")).toContain("agent skill is missing");
    await expect(access(path.join(repo.root, ".agents", "skills", "gitvaulty", "SKILL.md")))
      .rejects.toMatchObject({ code: "ENOENT" });
  });

  it("stays silent when the managed skill is current", async () => {
    await installAgentSkill(repo.root);
    const decide = vi.fn(async () => "install" as const);

    await ensureRepositoryAgentSkill(repo, options(decide));

    expect(decide).not.toHaveBeenCalled();
    expect(output).toEqual([]);
    expect(warnings).toEqual([]);
  });
});
