import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { agentSkillStatus, installAgentSkill } from "../src/agent-skill.js";

describe("GitVaulty agent skill", () => {
  it("installs the bundled instruction-only skill", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-agent-skill-"));

    await expect(agentSkillStatus(root)).resolves.toBe("missing");
    expect(await installAgentSkill(root)).toBe("installed");
    await expect(agentSkillStatus(root)).resolves.toBe("current");

    const installed = await readFile(
      path.join(root, ".agents", "skills", "gitvaulty", "SKILL.md"),
      "utf8",
    );
    expect(installed).toMatch(/^---\nname: gitvaulty\ndescription:/);
    expect(installed).toContain("gitvaulty run -f");
    expect(installed).toContain("Never print, log, or include secret values in prompts");
    expect(installed).toContain("not a security boundary");
  });

  it("treats CRLF content as the current repository skill", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-agent-skill-"));
    const skillFile = path.join(root, ".agents", "skills", "gitvaulty", "SKILL.md");
    await mkdir(path.dirname(skillFile), { recursive: true });
    const bundled = await readFile(new URL("../skills/gitvaulty/SKILL.md", import.meta.url), "utf8");
    await writeFile(skillFile, bundled.replaceAll("\n", "\r\n"));

    await expect(agentSkillStatus(root)).resolves.toBe("current");
    await expect(installAgentSkill(root)).resolves.toBe("current");
  });

  it("reports differing content without changing it", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-agent-skill-"));
    const skillFile = path.join(root, ".agents", "skills", "gitvaulty", "SKILL.md");
    await mkdir(path.dirname(skillFile), { recursive: true });
    await writeFile(skillFile, "custom instructions\n");

    await expect(agentSkillStatus(root)).resolves.toBe("different");
    await expect(installAgentSkill(root)).resolves.toBe("preserved");
    expect(await readFile(skillFile, "utf8")).toBe("custom instructions\n");
  });

  it("replaces differing content only when installation is requested", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-agent-skill-"));
    const skillFile = path.join(root, ".agents", "skills", "gitvaulty", "SKILL.md");
    await mkdir(path.dirname(skillFile), { recursive: true });
    await writeFile(skillFile, "old instructions\n");

    await expect(installAgentSkill(root, { replace: true })).resolves.toBe("updated");
    await expect(agentSkillStatus(root)).resolves.toBe("current");
    expect(await readFile(skillFile, "utf8")).toContain("name: gitvaulty");
  });

  it("rejects a symbolic link instead of reading or replacing it", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-agent-skill-"));
    const outside = path.join(root, "outside.md");
    const skillFile = path.join(root, ".agents", "skills", "gitvaulty", "SKILL.md");
    await mkdir(path.dirname(skillFile), { recursive: true });
    await writeFile(outside, "outside\n");
    await symlink(outside, skillFile);

    await expect(agentSkillStatus(root)).rejects.toThrow("regular file");
    await expect(installAgentSkill(root)).rejects.toThrow("regular file");
    expect(await readFile(outside, "utf8")).toBe("outside\n");
  });
});
