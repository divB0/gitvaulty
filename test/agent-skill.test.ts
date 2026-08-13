import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { installAgentSkill } from "../src/agent-skill.js";

describe("GitVaulty agent skill", () => {
  it("installs the bundled instruction-only skill", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-agent-skill-"));

    expect(await installAgentSkill(root)).toBe("installed");

    const installed = await readFile(
      path.join(root, ".agents", "skills", "gitvaulty", "SKILL.md"),
      "utf8",
    );
    expect(installed).toMatch(/^---\nname: gitvaulty\ndescription:/);
    expect(installed).toContain("gitvaulty run -f");
    expect(installed).toContain("Never print, log, or include secret values in prompts");
    expect(installed).toContain("not a security boundary");
  });

  it("preserves an existing repository skill", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "gitvaulty-agent-skill-"));
    const skillFile = path.join(root, ".agents", "skills", "gitvaulty", "SKILL.md");
    await mkdir(path.dirname(skillFile), { recursive: true });
    await writeFile(skillFile, "custom instructions\n");

    expect(await installAgentSkill(root)).toBe("preserved");
    expect(await readFile(skillFile, "utf8")).toBe("custom instructions\n");
  });
});
