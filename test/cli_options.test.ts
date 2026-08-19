import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const operationMocks = vi.hoisted(() => ({
  cleanSecretFiles: vi.fn(async () => ({ removed: [], retained: [] })),
  createGroup: vi.fn(async () => undefined),
  createSecretFile: vi.fn(async (_repository, file: string) => ({ file })),
  diffSecretFiles: vi.fn(async (): Promise<Array<{
    file: string;
    encryptedFile: string;
    oldContent: Buffer;
    newContent: Buffer;
  }>> => []),
  editSecretFile: vi.fn(async () => false),
  ensureRepositoryMetadata: vi.fn(async () => undefined),
  importSecretFile: vi.fn(async (_repository, file: string) => ({ file, bytes: 12 })),
  initialize: vi.fn(async () => ({ agentSkill: "installed" as const })),
  isInitialized: vi.fn(async () => true),
  materializeSecretFiles: vi.fn(async () => []),
  readSecretFile: vi.fn(async (_repository, file: string) => ({
    file,
    encryptedFile: `${file}.gitvaulty`,
    plaintext: Buffer.from("secret"),
    fingerprint: "a".repeat(64),
  })),
  registerUser: vi.fn(async () => undefined),
  runWithFiles: vi.fn(async () => ({ code: 0, retained: [] })),
  setFileAccess: vi.fn(async (_repository, file: string, access) => ({ path: `${file}.gitvaulty`, ...access })),
  statusSecretFiles: vi.fn(async () => []),
  updateSecretFile: vi.fn(async (_repository, file: string) => ({ file, bytes: 12 })),
}));

const keyMocks = vi.hoisted(() => ({
  createIdentity: vi.fn(async () => ({ identity: "AGE-SECRET-KEY-CREATED", recipient: "age1created" })),
  currentRecipient: vi.fn(async () => "age1owner"),
  identityFile: vi.fn(() => "/identity.txt"),
  readIdentity: vi.fn(async () => "AGE-SECRET-KEY-OWNER"),
  restoreIdentity: vi.fn(async () => ({ identity: "AGE-SECRET-KEY-RESTORED", recipient: "age1restored" })),
}));

const promptMocks = vi.hoisted(() => ({
  checkbox: vi.fn(),
  confirm: vi.fn(),
  input: vi.fn(),
  password: vi.fn(),
  select: vi.fn(),
}));

const repository = vi.hoisted(() => ({
  configFile: "/repository/.gitvaulty/config.yaml",
  excludeFile: "/repository/.git/info/exclude",
  registryFile: "/repository/.gitvaulty/recipients.json",
  root: "/repository",
  sopsConfigFile: "/repository/.sops.yaml",
}));

const repositoryMocks = vi.hoisted(() => ({
  findRepository: vi.fn(async () => repository),
}));

const registry = vi.hoisted(() => ({
  defaultGroup: "team",
  files: [{ path: "secret.txt.gitvaulty", groups: ["team"], users: [] }],
  groups: [
    { name: "production", members: ["owner"] },
    { name: "team", members: ["owner"] },
  ],
  users: [{ username: "owner", recipient: "age1owner" }],
  version: 3,
}));

vi.mock("@inquirer/prompts", () => promptMocks);

vi.mock("../src/agent-skill.js", () => ({
  agentSkillStatus: vi.fn(async () => "current"),
  installAgentSkill: vi.fn(async () => "current"),
}));

vi.mock("../src/key.js", () => keyMocks);

vi.mock("../src/repository.js", () => repositoryMocks);

vi.mock("../src/registry.js", () => ({
  normalizeGroupName: vi.fn((value: string) => value),
  readRegistry: vi.fn(async () => registry),
  usernamesFor: vi.fn(() => ["owner"]),
}));

vi.mock("../src/operations.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/operations.js")>(),
  ...operationMocks,
  encryptedFileFor: vi.fn((_repository, file: string) => `/repository/${file}.gitvaulty`),
}));

import { createProgram } from "../src/cli.js";

async function withStdoutTTY<T>(isTTY: boolean, action: () => Promise<T>): Promise<T> {
  const previous = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
  Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: isTTY });
  try { return await action(); }
  finally {
    if (previous) Object.defineProperty(process.stdout, "isTTY", previous);
    else Reflect.deleteProperty(process.stdout, "isTTY");
  }
}

describe("GitVaulty CLI option callbacks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    operationMocks.isInitialized.mockResolvedValue(true);
    keyMocks.readIdentity.mockResolvedValue("AGE-SECRET-KEY-OWNER");
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it("passes repeated access options to create, import, and access", async () => {
    await createProgram().parseAsync([
      "node", "gitvaulty", "create", "secret.txt",
      "--group", "production", "--group", "team", "--user", "owner",
    ]);
    expect(operationMocks.createSecretFile).toHaveBeenCalledWith(repository, "secret.txt", {
      groups: ["production", "team"],
      users: ["owner"],
    });

    await createProgram().parseAsync([
      "node", "gitvaulty", "import", "imported.txt",
      "--group", "production", "--user", "owner",
    ]);
    expect(operationMocks.importSecretFile).toHaveBeenCalledWith(repository, "imported.txt", {
      groups: ["production"],
      users: ["owner"],
    });

    await createProgram().parseAsync([
      "node", "gitvaulty", "access", "secret.txt",
      "--group", "production", "--user", "owner",
    ]);
    expect(operationMocks.setFileAccess).toHaveBeenCalledWith(repository, "secret.txt", {
      groups: ["production"],
      users: ["owner"],
    });
  });

  it("registers the current public recipient without access", async () => {
    await createProgram().parseAsync([
      "node", "gitvaulty", "user", "register", "Alice",
    ]);

    expect(operationMocks.registerUser).toHaveBeenCalledWith(repository, {
      username: "alice",
      recipient: "age1owner",
    });
  });

  it("makes explicit initialization idempotent through the shared bootstrap", async () => {
    const agentSkillPreflight = vi.fn(async () => undefined);

    await createProgram({ agentSkillPreflight, interactive: true }).parseAsync([
      "node", "gitvaulty", "init",
    ]);

    expect(keyMocks.readIdentity).toHaveBeenCalledOnce();
    expect(operationMocks.ensureRepositoryMetadata).toHaveBeenCalledWith(repository);
    expect(promptMocks.input).not.toHaveBeenCalled();
    expect(operationMocks.initialize).not.toHaveBeenCalled();
    expect(agentSkillPreflight).toHaveBeenCalledWith(repository);
    expect(process.stdout.write).toHaveBeenCalledWith("GitVaulty is ready.\n");
  });

  it("runs agent skill preflight for initialized repository commands", async () => {
    operationMocks.isInitialized.mockResolvedValueOnce(true);
    const agentSkillPreflight = vi.fn(async () => undefined);

    await createProgram({ agentSkillPreflight }).parseAsync([
      "node", "gitvaulty", "user", "list",
    ]);

    expect(agentSkillPreflight).toHaveBeenCalledWith(repository);
  });

  it("implicitly initializes before continuing the requested command", async () => {
    operationMocks.isInitialized.mockResolvedValueOnce(false);
    promptMocks.input.mockResolvedValueOnce("Owner");
    const agentSkillPreflight = vi.fn(async () => undefined);

    await createProgram({ agentSkillPreflight, interactive: true }).parseAsync([
      "node", "gitvaulty", "group", "create", "production",
    ]);

    expect(operationMocks.initialize).toHaveBeenCalledWith(repository, {
      username: "owner",
      recipient: "age1owner",
    });
    expect(agentSkillPreflight).toHaveBeenCalledWith(repository);
    expect(operationMocks.createGroup).toHaveBeenCalledWith(repository, "production");
    expect(operationMocks.initialize.mock.invocationCallOrder[0])
      .toBeLessThan(operationMocks.createGroup.mock.invocationCallOrder[0]!);
    expect(process.stderr.write).toHaveBeenCalledWith("GitVaulty initialized.\n");
  });

  it("does not inspect repositories for global key commands", async () => {
    const agentSkillPreflight = vi.fn(async () => undefined);

    await createProgram({ agentSkillPreflight }).parseAsync([
      "node", "gitvaulty", "key", "public",
    ]);

    expect(agentSkillPreflight).not.toHaveBeenCalled();
    expect(repositoryMocks.findRepository).not.toHaveBeenCalled();
  });

  it("restores a missing key with masked input before implicit initialization", async () => {
    operationMocks.isInitialized.mockResolvedValueOnce(false);
    keyMocks.readIdentity.mockRejectedValueOnce(new Error("No GitVaulty key found at /identity.txt."));
    promptMocks.select.mockResolvedValueOnce("restore");
    promptMocks.password.mockResolvedValueOnce("AGE-SECRET-KEY-BACKUP");
    promptMocks.input.mockResolvedValueOnce("owner");
    const agentSkillPreflight = vi.fn(async () => undefined);

    await createProgram({ agentSkillPreflight, interactive: true }).parseAsync([
      "node", "gitvaulty", "group", "create", "production",
    ]);

    expect(promptMocks.select).toHaveBeenCalledWith(expect.objectContaining({
      choices: expect.arrayContaining([
        expect.objectContaining({ value: "restore" }),
        expect.objectContaining({ value: "create" }),
        expect.objectContaining({ value: "cancel" }),
      ]),
    }), expect.objectContaining({ output: process.stderr }));
    expect(promptMocks.password).toHaveBeenCalledWith(expect.objectContaining({ mask: "*" }), expect.objectContaining({ output: process.stderr }));
    expect(keyMocks.restoreIdentity).toHaveBeenCalledWith("AGE-SECRET-KEY-BACKUP", "/identity.txt");
    expect(operationMocks.initialize).toHaveBeenCalledWith(repository, {
      username: "owner",
      recipient: "age1restored",
    });
    expect(agentSkillPreflight).toHaveBeenCalledWith(repository);
    expect(process.stdout.write).not.toHaveBeenCalledWith(expect.stringContaining("AGE-SECRET-KEY"));
  });

  it("creates a missing key when selected", async () => {
    operationMocks.isInitialized.mockResolvedValueOnce(false);
    keyMocks.readIdentity.mockRejectedValueOnce(new Error("No GitVaulty key found at /identity.txt."));
    promptMocks.select.mockResolvedValueOnce("create");
    promptMocks.input.mockResolvedValueOnce("owner");

    await createProgram({ interactive: true }).parseAsync([
      "node", "gitvaulty", "group", "create", "production",
    ]);

    expect(keyMocks.createIdentity).toHaveBeenCalledOnce();
    expect(operationMocks.initialize).toHaveBeenCalledWith(repository, {
      username: "owner",
      recipient: "age1created",
    });
    expect(process.stderr.write).toHaveBeenCalledWith(expect.stringContaining("Back it up with `gitvaulty key backup`"));
  });

  it("cancels missing-key bootstrap without repository changes", async () => {
    keyMocks.readIdentity.mockRejectedValueOnce(new Error("No GitVaulty key found at /identity.txt."));
    promptMocks.select.mockResolvedValueOnce("cancel");

    await expect(createProgram({ interactive: true }).parseAsync([
      "node", "gitvaulty", "group", "list",
    ])).rejects.toThrow("A GitVaulty key is required");

    expect(operationMocks.initialize).not.toHaveBeenCalled();
    expect(operationMocks.ensureRepositoryMetadata).not.toHaveBeenCalled();
  });

  it("fails non-interactively when a required key is missing", async () => {
    keyMocks.readIdentity.mockRejectedValueOnce(new Error("No GitVaulty key found at /identity.txt."));

    await expect(createProgram({ interactive: false }).parseAsync([
      "node", "gitvaulty", "group", "list",
    ])).rejects.toThrow("Run `gitvaulty key restore` or `gitvaulty key create`");

    expect(promptMocks.select).not.toHaveBeenCalled();
  });

  it("passes repeated file options to materialize, clean, and status", async () => {
    const arguments_ = ["--file", ".env", "--file", "config/secrets.yaml"];
    await createProgram().parseAsync(["node", "gitvaulty", "materialize", ...arguments_]);
    await createProgram().parseAsync(["node", "gitvaulty", "clean", ...arguments_]);
    await createProgram().parseAsync(["node", "gitvaulty", "status", ...arguments_]);

    const files = [".env", "config/secrets.yaml"];
    expect(operationMocks.materializeSecretFiles).toHaveBeenCalledWith(repository, files);
    expect(operationMocks.cleanSecretFiles).toHaveBeenCalledWith(repository, files);
    expect(operationMocks.statusSecretFiles).toHaveBeenCalledWith(repository, files);
  });

  it("passes positional paths to diff and defaults to all accessible files", async () => {
    await createProgram().parseAsync(["node", "gitvaulty", "diff"]);
    await createProgram().parseAsync([
      "node", "gitvaulty", "diff", ".env", "config/secrets.yaml",
    ]);

    expect(operationMocks.diffSecretFiles).toHaveBeenNthCalledWith(1, repository, []);
    expect(operationMocks.diffSecretFiles).toHaveBeenNthCalledWith(
      2,
      repository,
      [".env", "config/secrets.yaml"],
    );
  });

  it("prints plaintext differences with Git-like exit behavior", async () => {
    const difference = {
      file: ".env",
      encryptedFile: ".env.gitvaulty",
      oldContent: Buffer.from("TOKEN=old\n"),
      newContent: Buffer.from("TOKEN=new\n"),
    };
    operationMocks.diffSecretFiles.mockResolvedValue([difference]);

    await createProgram().parseAsync(["node", "gitvaulty", "diff", ".env"]);
    expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining("-TOKEN=old\n+TOKEN=new\n"));
    expect(process.exitCode).toBeUndefined();

    await createProgram().parseAsync(["node", "gitvaulty", "diff", ".env", "--exit-code"]);
    expect(process.exitCode).toBe(1);
  });

  it("writes exact secret bytes to non-interactive stdout", async () => {
    const plaintext = Buffer.from([0, 1, 2, 10, 65, 255]);
    operationMocks.readSecretFile.mockResolvedValueOnce({
      file: "secret.bin",
      encryptedFile: "secret.bin.gitvaulty",
      plaintext,
      fingerprint: "b".repeat(64),
    });

    await withStdoutTTY(false, () => createProgram().parseAsync([
      "node", "gitvaulty", "cat", "secret.bin",
    ]));

    expect(operationMocks.readSecretFile).toHaveBeenCalledWith(repository, "secret.bin");
    expect(process.stdout.write).toHaveBeenCalledTimes(1);
    expect(process.stdout.write).toHaveBeenCalledWith(plaintext);
  });

  it("refuses interactive output unless forced", async () => {
    await withStdoutTTY(true, async () => {
      await expect(createProgram().parseAsync([
        "node", "gitvaulty", "cat", "secret.bin",
      ])).rejects.toThrow("Refusing to print a secret to an interactive terminal");
      expect(operationMocks.readSecretFile).not.toHaveBeenCalled();

      await createProgram().parseAsync([
        "node", "gitvaulty", "cat", "secret.bin", "--force",
      ]);
    });

    expect(operationMocks.readSecretFile).toHaveBeenCalledWith(repository, "secret.bin");
    expect(process.stdout.write).toHaveBeenCalledWith(Buffer.from("secret"));
  });

  it("passes file options and the child command to run", async () => {
    await createProgram().parseAsync([
      "node", "gitvaulty", "run", "--file", ".env", "--file", "config/secrets.yaml",
      "--", "node", "server.js", "--inspect",
    ]);

    expect(operationMocks.runWithFiles).toHaveBeenCalledWith(
      repository,
      [".env", "config/secrets.yaml"],
      ["node", "server.js", "--inspect"],
    );
  });

  it("passes an empty selection for an explicit all-files run", async () => {
    await createProgram().parseAsync([
      "node", "gitvaulty", "run", "--all", "--", "npm", "start",
    ]);

    expect(operationMocks.runWithFiles).toHaveBeenCalledWith(
      repository,
      [],
      ["npm", "start"],
    );
  });

  it("requires an explicit run scope", async () => {
    await expect(createProgram().parseAsync([
      "node", "gitvaulty", "run", "--", "npm", "start",
    ])).rejects.toThrow("Choose --all or at least one --file.");

    expect(operationMocks.runWithFiles).not.toHaveBeenCalled();
  });

  it("rejects conflicting run scopes", async () => {
    await expect(createProgram().parseAsync([
      "node", "gitvaulty", "run", "--all", "--file", ".env", "--", "npm", "start",
    ])).rejects.toThrow("Choose either --all or --file, not both.");

    expect(operationMocks.runWithFiles).not.toHaveBeenCalled();
  });
});
