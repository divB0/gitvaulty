import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { installAgentSkill } from "../src/agent-skill.js";
import { ensureRepositoryAgentSkill } from "../src/cli.js";
import { ensureRepositoryConfig, writeAgentSkillMode } from "../src/config.js";
import { executeChecked } from "../src/process.js";
import { findRepository, type Repository } from "../src/repository.js";

describe("repository agent skill preflight", () => {
  let repo: Repository;
  let notices: string[];

  beforeEach(async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-agent-preflight-"));
    await executeChecked("git", ["init", "-q"], { cwd: root });
    repo = await findRepository(root);
    await ensureRepositoryConfig(repo);
    notices = [];
  });

  const options = () => ({
    writeNotice: (message: string) => { notices.push(message); },
  });

  it("installs a missing managed skill automatically", async () => {
    await ensureRepositoryAgentSkill(repo, options());

    expect(await readFile(path.join(repo.root, ".agents", "skills", "gitvaulty", "SKILL.md"), "utf8"))
      .toContain("name: gitvaulty");
    expect(notices.join("")).toContain("Installed agent skill");
  });

  it("replaces a differing managed skill automatically", async () => {
    const skillFile = path.join(repo.root, ".agents", "skills", "gitvaulty", "SKILL.md");
    await installAgentSkill(repo.root);
    await writeFile(skillFile, "custom instructions\n");

    await ensureRepositoryAgentSkill(repo, options());

    expect(await readFile(skillFile, "utf8")).toContain("name: gitvaulty");
    expect(notices.join("")).toContain("Updated agent skill");
  });

  it("preserves a differing skill when repository management is disabled", async () => {
    const skillFile = path.join(repo.root, ".agents", "skills", "gitvaulty", "SKILL.md");
    await installAgentSkill(repo.root);
    await writeFile(skillFile, "custom instructions\n");
    await writeAgentSkillMode(repo, "disabled");

    await ensureRepositoryAgentSkill(repo, options());

    expect(await readFile(skillFile, "utf8")).toBe("custom instructions\n");
    expect(notices).toEqual([]);
  });

  it("stays silent when the managed skill is current", async () => {
    await installAgentSkill(repo.root);
    await ensureRepositoryAgentSkill(repo, options());

    expect(notices).toEqual([]);
  });
});
