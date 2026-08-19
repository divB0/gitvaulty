import { describe, expect, it, vi } from "vitest";

import {
  backupKey,
  type KeyBackupDependencies,
  type KeyBackupOptions,
} from "../src/key-backup.js";
import type { ProcessResult } from "../src/process.js";

const identity = "GITVAULTY-IDENTITY-PRIVATE";

function result(stdout = "", stderr = "", code = 0): ProcessResult {
  return { stdout, stderr, code };
}

function dependencies(overrides: Partial<KeyBackupDependencies> = {}): KeyBackupDependencies {
  return {
    confirm: vi.fn(async () => true),
    environment: {},
    execute: vi.fn(async () => result()),
    executeInteractive: vi.fn(async () => result()),
    readIdentity: vi.fn(async () => identity),
    select: vi.fn(),
    writeClipboard: vi.fn(async () => undefined),
    writeStderr: vi.fn(),
    writeStdout: vi.fn(),
    ...overrides,
  };
}

function selections(values: string[]) {
  return vi.fn(async (_prompt: { message: string; choices: Array<{ name: string; value: string }> }) => values.shift()!);
}

async function run(options: KeyBackupOptions, deps: KeyBackupDependencies): Promise<void> {
  await backupKey(options, deps);
}

describe("key backup destinations", () => {
  it("prints only when --print is explicit", async () => {
    const deps = dependencies();

    await run({ interactive: false, print: true }, deps);

    expect(deps.readIdentity).toHaveBeenCalledOnce();
    expect(deps.writeStdout).toHaveBeenCalledWith(`${identity}\n`);
    expect(deps.select).not.toHaveBeenCalled();
  });

  it("copies without prompting when --clipboard is explicit", async () => {
    const deps = dependencies();

    await run({ clipboard: true, interactive: false }, deps);

    expect(deps.writeClipboard).toHaveBeenCalledWith(identity);
    expect(deps.writeStderr).toHaveBeenCalledWith("Private GitVaulty key copied to the clipboard.\n");
    expect(deps.writeStdout).not.toHaveBeenCalled();
  });

  it("reports an unavailable clipboard without printing the identity", async () => {
    const deps = dependencies({ writeClipboard: vi.fn(async () => { throw new Error("headless"); }) });

    await expect(run({ clipboard: true, interactive: false }, deps))
      .rejects.toThrow("system clipboard is unavailable");

    expect(deps.writeStdout).not.toHaveBeenCalled();
    expect(deps.writeStderr).not.toHaveBeenCalledWith(expect.stringContaining(identity));
  });

  it("rejects conflicting flags before reading the identity", async () => {
    const deps = dependencies();

    await expect(run({ clipboard: true, interactive: false, print: true }, deps))
      .rejects.toThrow("Choose either --clipboard or --print");

    expect(deps.readIdentity).not.toHaveBeenCalled();
  });

  it("requires a destination flag outside an interactive terminal", async () => {
    const deps = dependencies();

    await expect(run({ interactive: false }, deps))
      .rejects.toThrow("Use --clipboard or --print");

    expect(deps.select).not.toHaveBeenCalled();
    expect(deps.readIdentity).not.toHaveBeenCalled();
  });

  it("cancels without reading the identity", async () => {
    const deps = dependencies({ select: selections(["cancel"]) });

    await run({ interactive: true }, deps);

    expect(deps.readIdentity).not.toHaveBeenCalled();
  });

  it("keeps unavailable providers selectable and shows installation guidance", async () => {
    const select = selections(["password-manager", "bitwarden", "back", "back", "cancel"]);
    const execute = vi.fn(async (command: string, args: string[]) => {
      if (command === "op" && args[0] === "--version") return result("2.31.0\n");
      if (command === "bw" && args[0] === "--version") throw Object.assign(new Error("missing"), { code: "ENOENT" });
      return result();
    });
    const deps = dependencies({ execute, select });

    await run({ interactive: true }, deps);

    const providerPrompt = select.mock.calls.find(([prompt]) => prompt.message === "Choose a password manager")?.[0];
    expect(providerPrompt).toBeDefined();
    expect(providerPrompt!.choices).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: expect.stringContaining("1Password  ✓ Detected"), value: "onepassword" }),
      expect.objectContaining({ name: expect.stringContaining("Bitwarden  ○ CLI not found"), value: "bitwarden" }),
    ]));
    expect(deps.writeStderr).toHaveBeenCalledWith(expect.stringContaining("npm install --global @bitwarden/cli"));
    expect(deps.readIdentity).not.toHaveBeenCalled();
  });

  it("shows official 1Password CLI installation guidance", async () => {
    const select = selections(["password-manager", "onepassword", "back", "back", "cancel"]);
    const execute = vi.fn(async (command: string, args: string[]) => {
      if (command === "op" && args[0] === "--version") throw Object.assign(new Error("missing"), { code: "ENOENT" });
      if (command === "bw" && args[0] === "--version") return result("version\n");
      return result();
    });
    const deps = dependencies({ execute, select });

    await run({ interactive: true }, deps);

    expect(deps.writeStderr).toHaveBeenCalledWith(expect.stringContaining("developer.1password.com/docs/cli/get-started"));
    expect(deps.readIdentity).not.toHaveBeenCalled();
  });

  it("rechecks an unavailable provider without restarting", async () => {
    const select = selections(["password-manager", "bitwarden", "recheck", "bitwarden", "back", "back", "cancel"]);
    let bitwardenProbes = 0;
    const execute = vi.fn(async (command: string, args: string[]) => {
      if (args[0] === "--version") {
        if (command === "bw" && bitwardenProbes++ === 0) throw Object.assign(new Error("missing"), { code: "ENOENT" });
        return result("version\n");
      }
      if (command === "bw" && args[0] === "status") return result(JSON.stringify({ status: "unauthenticated" }));
      return result();
    });
    const deps = dependencies({ execute, select });

    await run({ interactive: true }, deps);

    expect(bitwardenProbes).toBe(3);
    expect(deps.writeStderr).toHaveBeenCalledWith(expect.stringContaining("bw login"));
    expect(deps.readIdentity).not.toHaveBeenCalled();
  });

  it("creates a concealed 1Password item through stdin", async () => {
    const select = selections(["password-manager", "onepassword"]);
    const template = {
      category: "PASSWORD",
      fields: [{ id: "password", label: "password", type: "CONCEALED", value: "" }],
      title: "",
    };
    const execute = vi.fn(async (command: string, args: string[], options = {}) => {
      expect(args).not.toContain(identity);
      if (args[0] === "--version") return result("version\n");
      if (command === "op" && args.join(" ") === "item template get Password") return result(JSON.stringify(template));
      if (command === "op" && args[0] === "item" && args[1] === "create") {
        const input = JSON.parse((options as { input: string }).input);
        expect(input.title).toBe("GitVaulty recovery key");
        expect(input.fields).toContainEqual(expect.objectContaining({ id: "password", value: identity }));
        return result(JSON.stringify({ id: "item-id", title: input.title }));
      }
      return result();
    });
    const deps = dependencies({ execute, select });

    await run({ interactive: true }, deps);

    expect(deps.writeStderr).toHaveBeenCalledWith("Saved the private GitVaulty key in 1Password.\n");
    expect(deps.writeStdout).not.toHaveBeenCalled();
  });

  it("guides unauthenticated Bitwarden users without reading the identity", async () => {
    const select = selections(["password-manager", "bitwarden", "back", "back", "cancel"]);
    const execute = vi.fn(async (command: string, args: string[]) => {
      if (args[0] === "--version") return result("version\n");
      if (command === "bw" && args[0] === "status") return result(JSON.stringify({ status: "unauthenticated" }));
      return result();
    });
    const deps = dependencies({ execute, select });

    await run({ interactive: true }, deps);

    expect(deps.writeStderr).toHaveBeenCalledWith(expect.stringContaining("bw login"));
    expect(deps.readIdentity).not.toHaveBeenCalled();
  });

  it("unlocks Bitwarden, creates a secure note through stdin, and locks its session", async () => {
    const select = selections(["password-manager", "bitwarden"]);
    const executeInteractive = vi.fn(async () => result("temporary-session\n"));
    const execute = vi.fn(async (command: string, args: string[], options = {}) => {
      expect(args).not.toContain(identity);
      if (args[0] === "--version") return result("version\n");
      if (command === "bw" && args[0] === "status") return result(JSON.stringify({ status: "locked" }));
      if (command === "bw" && args.join(" ") === "create item") {
        const processOptions = options as { env: NodeJS.ProcessEnv; input: string };
        expect(processOptions.env.BW_SESSION).toBe("temporary-session");
        const item = JSON.parse(Buffer.from(processOptions.input, "base64").toString("utf8"));
        expect(item).toMatchObject({
          name: "GitVaulty recovery key",
          notes: identity,
          secureNote: { type: 0 },
          type: 2,
        });
        return result(JSON.stringify({ id: "item-id", notes: identity }));
      }
      if (command === "bw" && args[0] === "lock") return result();
      return result();
    });
    const deps = dependencies({ execute, executeInteractive, select });

    await run({ interactive: true }, deps);

    expect(executeInteractive).toHaveBeenCalledWith("bw", ["unlock", "--raw"], expect.any(Object));
    expect(execute).toHaveBeenCalledWith("bw", ["lock"], expect.objectContaining({
      env: expect.objectContaining({ BW_SESSION: "temporary-session" }),
    }));
    expect(deps.writeStderr).toHaveBeenCalledWith("Saved the private GitVaulty key in Bitwarden.\n");
    expect(deps.writeStdout).not.toHaveBeenCalled();
  });

  it("uses an existing Bitwarden session without locking it", async () => {
    const select = selections(["password-manager", "bitwarden"]);
    const execute = vi.fn(async (command: string, args: string[]) => {
      if (args[0] === "--version") return result("version\n");
      if (command === "bw" && args[0] === "status") return result(JSON.stringify({ status: "unlocked" }));
      return result();
    });
    const deps = dependencies({ environment: { BW_SESSION: "existing-session" }, execute, select });

    await run({ interactive: true }, deps);

    expect(deps.executeInteractive).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalledWith("bw", ["lock"], expect.anything());
  });

  it("redacts the identity from provider errors", async () => {
    const select = selections(["password-manager", "onepassword"]);
    const execute = vi.fn(async (command: string, args: string[]) => {
      if (args[0] === "--version") return result("version\n");
      if (args.join(" ") === "item template get Password") {
        return result(JSON.stringify({ fields: [{ id: "password", value: "" }] }));
      }
      return result("", `provider rejected ${identity}`, 1);
    });
    const deps = dependencies({ execute, select });

    await expect(run({ interactive: true }, deps)).rejects.toThrow("provider rejected [redacted]");
  });
});
