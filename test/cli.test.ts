import { describe, expect, it } from "vitest";

import { Command } from "commander";
import { createProgram, formatGroups, formatUsers, main } from "../src/cli.js";
import type { Registry } from "../src/registry.js";

const registry: Registry = {
  version: 3,
  defaultGroup: "team",
  users: [
    { username: "zoe", recipient: "age1nx73yf2gmghjapkvxzkx26z72uakmnppchya8d4xfjd67hhglqdq7swsm0" },
    { username: "alice", recipient: "age1m5zx6fzr9m7jwq4z0fu2r9nlzf4a32l9qk58880nejj2fp9u7ycse9dgse" },
  ],
  groups: [
    { name: "production", members: ["alice"] },
    { name: "team", members: ["alice", "zoe"] },
  ],
  files: [{ path: ".env.gitvaulty", groups: ["team"], users: [] }],
};

describe("GitVaulty CLI", () => {
  it("exposes group-first file access commands", () => {
    const program = createProgram();
    expect(program.name()).toBe("gitvaulty");
    expect(program.commands.map((command) => command.name())).toEqual([
      "init",
      "create",
      "import",
      "access",
      "edit",
      "materialize",
      "clean",
      "status",
      "run",
      "key",
      "user",
      "group",
    ]);

    const command = (name: string) => program.commands.find((item) => item.name() === name);
    expect(command("create")?.options.map((option) => option.long)).toEqual(["--group", "--user"]);
    expect(command("import")?.options.map((option) => option.long)).toEqual(["--update", "--group", "--user"]);
    expect(command("access")?.options.map((option) => option.long)).toEqual(["--group", "--user"]);
    expect(command("run")?.options.map((option) => option.long)).toEqual(["--file"]);
    expect(command("key")?.commands.map((item) => item.name())).toEqual(["create", "public", "backup", "restore"]);
    expect(command("user")?.commands.map((item) => item.name())).toEqual(["add", "list", "remove"]);
    expect(command("group")?.commands.map((item) => item.name())).toEqual(["create", "add", "remove", "list", "delete"]);
  });

  it("formats deterministic user memberships", () => {
    expect(formatUsers(registry)).toBe([
      "USERNAME  GROUPS",
      "alice     production, team",
      "zoe       team",
      "",
    ].join("\n"));
  });

  it("formats groups and marks the default", () => {
    expect(formatGroups(registry)).toBe([
      "GROUP           MEMBERS",
      "production      alice",
      "team (default)  alice, zoe",
      "",
    ].join("\n"));
  });

  it("attempts best-effort edit cleanup before parsing the requested command", async () => {
    const events: string[] = [];
    const program = new Command();
    program.exitOverride();
    program.command("probe").action(() => { events.push("command"); });

    await main(["node", "gitvaulty", "probe"], async () => {
      events.push("cleanup");
      throw new Error("temp directory unavailable");
    }, program);

    expect(events).toEqual(["cleanup", "command"]);
  });
});
