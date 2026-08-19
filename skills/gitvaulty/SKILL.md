---
name: gitvaulty
description: Use GitVaulty-protected development files safely when running applications, tests, deployment tools, or coding agents. Apply when a repository contains `*.gitvaulty` files or a task needs `.env` files, credentials, certificates, or other secrets managed by GitVaulty.
---

# Use GitVaulty secrets safely

1. Select only the files required for the task. Prefer explicit `-f` options over exposing every
   accessible file.
2. Run the consuming command through GitVaulty:

   ```sh
   npx gitvaulty run -f .env -- node --env-file=.env app.js
   ```

   Repeat `-f` for additional files. Pass file paths to applications in their native form; do not
   place secret values in command arguments or environment assignments.
3. Let the application read the temporary native files. Do not read their contents merely to pass
   values to another command.
4. After the command, review GitVaulty's cleanup warnings. It removes only unchanged files created
   by that invocation and preserves modified files.

## Guardrails

- Never print, log, or include secret values in prompts, chat messages, command arguments, commit
  messages, issue text, or generated documentation.
- Never use `cat`, shell interpolation, command substitution, or debug tracing to expose a secret.
- Never commit plaintext secret files. Commit only the corresponding `*.gitvaulty` files and public
  GitVaulty metadata.
- Treat `.gitvaulty/recipients.json` as signed access-control policy. Do not edit it by hand, replace
  policy history, or run membership commands unless the task explicitly authorizes an access change.
- Ordinary group members may decrypt but cannot change membership. Use group membership or manager
  commands only as a registered manager, and include the signed registry and re-encrypted files in
  the same reviewed commit.
- Prefer `gitvaulty run` for temporary access. Use `gitvaulty materialize` only when persistent local
  plaintext is necessary, then use `gitvaulty status` and `gitvaulty clean` when finished.
- Do not modify a materialized secret unless the task explicitly requires changing that secret.
- Treat these instructions as safer operating guidance, not a security boundary. An agent with
  unrestricted shell access can still read plaintext while it is materialized. Enforce hard
  isolation and prompt blocking in the agent harness or sandbox.
