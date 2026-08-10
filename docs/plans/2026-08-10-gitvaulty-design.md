# GitVaulty TypeScript CLI Design

## Product boundary

GitVaulty is a convention-driven, Git-backed secrets CLI. It stores encrypted values and public
access metadata in Git while keeping each developer's private age identity in the repository's Git
metadata directory. SOPS and age are implementation details: users work with vaults, keys, users,
templates, and commands.

The first release intentionally has no plugin system, configuration loader, automatic hook
installer, web service, or binary-secret workflow. Text templates cover `.env`, Terraform JSON,
PEM, JSON, YAML, and other repository configuration. `vault check` is the primitive that projects
may call from Git hooks or CI.

## Repository convention

```text
.gitvaulty/
  recipients.json
.sops.yaml
vaults/
  dev/
    vault.sops.json
    templates/
      apps/api/.env.local.tpl
  prod/
    vault.sops.json
    templates/
      apps/api/.env.production.local.tpl
```

The directory under `vaults/` is the vault name. Template paths mirror output paths from the
repository root, with the final `.tpl` suffix removed. GitVaulty writes rendered files with mode
`0600` and adds their exact paths to `.git/info/exclude` so plaintext cannot be accidentally added
from that clone. Templates support `{{path.to.value}}` for raw values and `{{json path.to.value}}`
for JSON encoding. Missing values are errors.

`.gitvaulty/recipients.json` maps stable user IDs to native age public recipients and the vaults
they may decrypt. `.sops.yaml` is generated from that registry. The private identity lives at
`.git/gitvaulty/age/keys.txt`, resolved through Git's common metadata directory so worktrees share
the same identity.

## Commands

```text
gitvaulty init
gitvaulty vault create <name>
gitvaulty vault edit <name>
gitvaulty vault render <name>
gitvaulty vault check <name>
gitvaulty run <name> -- <command...>
gitvaulty key generate
gitvaulty key import
gitvaulty user add
gitvaulty user remove
```

`init` creates the metadata registry and generated SOPS configuration. If no local identity exists,
it asks whether to generate or import one, then registers the first user. `vault create` grants the
current user access and creates an encrypted JSON document containing an empty `env` object.
`vault edit` delegates editing to SOPS. `render` decrypts only in memory and writes mirrored output
files. `check` renders in memory and exits unsuccessfully for missing or stale output. `run` injects
only the top-level `env` object's primitive values into the child process.

`user add` collects a user ID, public recipient, and vault selection, then updates SOPS recipients.
`user remove` rotates affected data keys, removes the recipient wrappers, and refuses to leave a
vault without a recipient. Removing access cannot revoke historical Git versions or plaintext a
former user already copied; underlying provider credentials must be rotated separately.

## Implementation and quality

The package is ESM TypeScript for Node.js 20+, built with tsup. Commander provides deterministic
commands, Inquirer provides secret-safe prompts, `age-encryption` generates and validates native
age identities, and platform-specific optional npm dependencies provide the canonical SOPS binary.
The public library exports core operations so the CLI remains thin and tests can inject prompts,
process runners, and filesystem roots.

Tests use Vitest, temporary Git repositories, and injected runners for failure/rollback cases. A
real bundled-SOPS integration test covers initialization, encrypted vault creation, rendering,
freshness checking, and environment injection. Completion requires unit tests, type checking,
building, and an npm pack dry run.
