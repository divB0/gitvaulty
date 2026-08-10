import { describe, expect, it } from "vitest";

import { createProgram } from "../src/cli.js";

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
    expect(command("key")?.commands.map((item) => item.name())).toEqual(["generate", "import"]);
    expect(command("user")?.commands.map((item) => item.name())).toEqual(["add", "remove"]);
  });
});
