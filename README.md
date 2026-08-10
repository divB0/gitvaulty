<p align="center">
  <img src="https://raw.githubusercontent.com/divB0/gitvaulty/main/assets/gitvaulty-logo.png" alt="GitVaulty logo" width="180" />
</p>

<h1 align="center">gitvaulty</h1>

<p align="center">
  <strong>Git-backed secrets for humans.</strong>
</p>

GitVaulty keeps encrypted vaults and public access metadata in Git,
while every developer keeps their private age key locally. SOPS and age are installed through npm
and stay behind a small command surface.

## Install

GitVaulty requires Node.js 20 or newer.

```sh
npm install --save-dev gitvaulty
```

You can use it through `npx gitvaulty`, or add a shorter project script:

```json
{
  "scripts": {
    "secrets": "gitvaulty"
  }
}
```

## Quick start

```sh
npx gitvaulty init
npx gitvaulty vault create dev
npx gitvaulty vault edit dev
```

`init` generates or imports a repository key and registers the first user. A generated private key
is printed once as a recovery key; store it in your password manager. The working copy is stored at
`.git/gitvaulty/age/keys.txt`, outside Git's tracked files.

Edit the encrypted vault as JSON. Values under `env` are available to `run`; any JSON value can be
used by a template.

```json
{
  "env": {
    "DATABASE_URL": "postgres://...",
    "API_TOKEN": "..."
  },
  "terraform": {
    "cloudflare_api_token": "..."
  }
}
```

## Templates

Templates live under `vaults/<vault>/templates/`. Their path mirrors the generated path from the
repository root, with `.tpl` removed:

```text
vaults/dev/templates/apps/api/.env.local.tpl
  -> apps/api/.env.local

vaults/prod/templates/apps/api/.env.production.tpl
  -> apps/api/.env.production

vaults/prod/templates/terraform/secrets.auto.tfvars.json.tpl
  -> terraform/secrets.auto.tfvars.json
```

A template uses `{{path.to.value}}` for a primitive or `{{json path.to.value}}` for JSON encoding:

```dotenv
DATABASE_URL={{env.DATABASE_URL}}
API_TOKEN={{env.API_TOKEN}}
```

```json
{{json terraform}}
```

Render and verify generated files with:

```sh
npx gitvaulty vault render dev
npx gitvaulty vault check dev
```

Rendered files receive mode `0600` and are added to the clone-local Git exclude file. Commit the
encrypted vault, its plaintext templates, `.gitvaulty/recipients.json`, and `.sops.yaml`—not the
rendered files. `vault check` is suitable for a Git hook or a local preflight check.

## Run a command

```sh
npx gitvaulty run dev -- npm run dev
```

Only primitive values from the vault's top-level `env` object are added to the child process.

## Keys and users

```sh
npx gitvaulty key generate
npx gitvaulty key import
npx gitvaulty user add
npx gitvaulty user list
npx gitvaulty user remove
```

A new developer sends an existing user one of these **public** recipients:

- a native age recipient beginning with `age1...`;
- an OpenSSH Ed25519 public key beginning with `ssh-ed25519`.

`user add` detects the format automatically, strips any SSH comment, suggests a lowercase username
when the comment permits it, and asks the existing user to confirm the username and vault access.
Never share an `AGE-SECRET-KEY-...` recovery key or an SSH private key. `user list` shows usernames,
detected key types, and vault access without printing complete key material.

Native age keys are the default. SSH users keep the matching private key at the conventional
`~/.ssh/id_ed25519` path; custom paths, agent-only keys, hardware-backed SSH identities, RSA keys,
and other SSH algorithms are not supported yet. Only someone who can already decrypt the affected
vaults can add or remove access.

Removing a user rotates the affected vault data keys and removes that user's recipient. It cannot
erase Git history or plaintext the user previously copied, so rotate external database, cloud, and
API credentials after offboarding.

## Repository layout

```text
.gitvaulty/recipients.json              # public users and vault access
.sops.yaml                              # generated public SOPS rules
vaults/dev/vault.sops.json              # encrypted values
vaults/dev/templates/path/to/file.tpl   # plaintext shape, no secret values
```

There is intentionally no project configuration file: paths and behavior are convention-based.

## License

MIT
