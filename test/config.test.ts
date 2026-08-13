import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import {
  ensureRepositoryConfig,
  readRepositoryConfig,
  writeAgentSkillMode,
} from "../src/config.js";
import { executeChecked } from "../src/process.js";
import { findRepository, type Repository } from "../src/repository.js";

describe("GitVaulty repository configuration", () => {
  let repo: Repository;

  beforeEach(async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-config-"));
    await executeChecked("git", ["init", "-q"], { cwd: root });
    repo = await findRepository(root);
    await mkdir(path.dirname(repo.configFile), { recursive: true });
  });

  it("defaults a missing configuration to managed without writing a file", async () => {
    await expect(readRepositoryConfig(repo)).resolves.toEqual({
      version: 1,
      agentSkill: { mode: "managed" },
    });
    await expect(access(repo.configFile)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("creates the default YAML configuration when requested", async () => {
    await ensureRepositoryConfig(repo);

    expect(await readFile(repo.configFile, "utf8")).toBe([
      "version: 1",
      "agentSkill:",
      "  mode: managed",
      "",
    ].join("\n"));
  });

  it("rejects unsupported versions and agent skill modes", async () => {
    await writeFile(repo.configFile, "version: 2\nagentSkill:\n  mode: managed\n");
    await expect(readRepositoryConfig(repo)).rejects.toThrow("Unsupported GitVaulty configuration format");

    await writeFile(repo.configFile, "version: 1\nagentSkill:\n  mode: sometimes\n");
    await expect(readRepositoryConfig(repo)).rejects.toThrow("Unsupported GitVaulty configuration format");
  });

  it("updates the mode while preserving comments and unrelated settings", async () => {
    await writeFile(repo.configFile, [
      "# repository policy",
      "version: 1",
      "futureSetting: keep-me",
      "agentSkill:",
      "  # managed by the team",
      "  mode: managed",
      "",
    ].join("\n"));

    await writeAgentSkillMode(repo, "disabled");

    const stored = await readFile(repo.configFile, "utf8");
    expect(stored).toContain("# repository policy");
    expect(stored).toContain("futureSetting: keep-me");
    expect(stored).toContain("# managed by the team");
    expect(stored).toContain("mode: disabled");
    await expect(readRepositoryConfig(repo)).resolves.toEqual({
      version: 1,
      agentSkill: { mode: "disabled" },
    });
  });
});
