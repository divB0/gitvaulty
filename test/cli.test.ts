import { describe, expect, it } from "vitest";

import { createProgram } from "../src/cli.js";
import { formatUsers } from "../src/cli.js";

describe("GitVaulty CLI", () => {
  it("exposes the minimal command surface", () => {
    const program = createProgram();
    expect(program.name()).toBe("gitvaulty");
    expect(program.commands.map((command) => command.name())).toEqual([
      "init",
      "vault",
      "run",
      "key",
      "user",
    ]);

    const command = (name: string) => program.commands.find((item) => item.name() === name);
    expect(command("vault")?.commands.map((item) => item.name())).toEqual([
      "create",
      "edit",
      "render",
      "check",
    ]);
    expect(command("key")?.commands.map((item) => item.name())).toEqual(["create", "public", "backup", "restore"]);
    expect(command("user")?.commands.map((item) => item.name())).toEqual(["add", "list", "remove"]);
  });

  it("formats a deterministic user list", () => {
    expect(formatUsers([
      { username: "zoe", recipient: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", vaults: ["prod"] },
      { username: "alice", recipient: "age1nx73yf2gmghjapkvxzkx26z72uakmnppchya8d4xfjd67hhglqdq7swsm0", vaults: ["staging", "dev"] },
    ])).toBe([
      "USERNAME  KEY          VAULTS",
      "alice     age          dev, staging",
      "zoe       ssh-ed25519  prod",
      "",
    ].join("\n"));
  });
});
