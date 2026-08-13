import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const operationMocks = vi.hoisted(() => ({
  cleanSecretFiles: vi.fn(async () => ({ removed: [], retained: [] })),
  createSecretFile: vi.fn(async (_repository, file: string) => ({ file })),
  editSecretFile: vi.fn(async () => false),
  importSecretFile: vi.fn(async (_repository, file: string) => ({ file, bytes: 12 })),
  materializeSecretFiles: vi.fn(async () => []),
  runWithFiles: vi.fn(async () => ({ code: 0, retained: [] })),
  setFileAccess: vi.fn(async (_repository, file: string, access) => ({ path: `${file}.gitvaulty`, ...access })),
  statusSecretFiles: vi.fn(async () => []),
  updateSecretFile: vi.fn(async (_repository, file: string) => ({ file, bytes: 12 })),
}));

const repository = vi.hoisted(() => ({
  excludeFile: "/repository/.git/info/exclude",
  registryFile: "/repository/.gitvaulty/recipients.json",
  root: "/repository",
  sopsConfigFile: "/repository/.sops.yaml",
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

vi.mock("../src/key.js", () => ({
  createIdentity: vi.fn(),
  currentRecipient: vi.fn(async () => "age1owner"),
  identityFile: vi.fn(() => "/identity.txt"),
  readIdentity: vi.fn(async () => "AGE-SECRET-KEY-OWNER"),
  restoreIdentity: vi.fn(),
}));

vi.mock("../src/repository.js", () => ({ findRepository: vi.fn(async () => repository) }));

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

describe("GitVaulty CLI option callbacks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
