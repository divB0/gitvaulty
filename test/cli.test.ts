import { describe, expect, it } from "vitest";

import { createProgram, formatUsers } from "../src/cli.js";

describe("GitVaulty CLI", () => {
  it("exposes the native-file command surface", () => {
    const program = createProgram();
    expect(program.name()).toBe("gitvaulty");
    expect(program.commands.map((command) => command.name())).toEqual([
      "init",
      "create",
      "import",
      "edit",
      "materialize",
      "clean",
      "status",
      "run",
      "key",
      "user",
    ]);

    const command = (name: string) => program.commands.find((item) => item.name() === name);
    expect(command("run")?.options.map((option) => option.long)).toEqual(["--file"]);
    expect(command("run")?.options[0]?.mandatory).toBe(false);
    expect(command("import")?.options.map((option) => option.long)).toEqual(["--update"]);
    expect(command("key")?.commands.map((item) => item.name())).toEqual(["create", "public", "backup", "restore"]);
    expect(command("user")?.commands.map((item) => item.name())).toEqual(["add", "list", "remove"]);
  });

  it("formats deterministic per-file access", () => {
    expect(formatUsers([
      { username: "zoe", recipient: "age1nx73yf2gmghjapkvxzkx26z72uakmnppchya8d4xfjd67hhglqdq7swsm0", files: ["prod.yaml.gitvaulty"] },
      { username: "alice", recipient: "age1nx73yf2gmghjapkvxzkx26z72uakmnppchya8d4xfjd67hhglqdq7swsm0", files: ["terraform/prod.json.gitvaulty", ".env.gitvaulty"] },
    ])).toBe([
      "USERNAME  FILES",
      "alice     .env, terraform/prod.json",
      "zoe       prod.yaml",
      "",
    ].join("\n"));
  });
});
