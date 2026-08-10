import { Command } from "commander";

export function createProgram(): Command {
  const program = new Command()
    .name("gitvaulty")
    .description("Git-backed secrets for humans.")
    .version("0.1.0")
    .enablePositionalOptions();

  program.command("init").description("Initialize GitVaulty in this repository");

  const vault = program.command("vault").description("Manage encrypted vaults");
  vault.command("create <name>").description("Create an encrypted vault");
  vault.command("edit <name>").description("Edit an encrypted vault");
  vault.command("render <name>").description("Render a vault's templates");
  vault.command("check <name>").description("Check a vault's rendered files");

  program
    .command("run <name> [command...]")
    .description("Run a command with a vault's environment")
    .allowUnknownOption(true)
    .passThroughOptions();

  const key = program.command("key").description("Manage this repository's age key");
  key.command("generate").description("Generate a repository age key");
  key.command("import").description("Import a repository age key");

  const user = program.command("user").description("Manage vault access");
  user.command("add").description("Grant a user access to vaults");
  user.command("remove").description("Remove a user's vault access");

  return program;
}

export async function main(argv = process.argv): Promise<void> {
  await createProgram().parseAsync(argv);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  });
}
