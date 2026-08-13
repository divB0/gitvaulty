# Self-registration and README workflow design

## Goal

Make repository onboarding match GitVaulty's trust model: a new developer publishes their own public age recipient in Git, while an existing authorized developer separately grants group access and re-encrypts affected files.

## Command model

Add `gitvaulty user register <username>`. The command loads or creates the caller's global age identity, derives its public recipient, and adds a user entry to `.gitvaulty/recipients.json` with no group memberships or direct file grants. It does not accept a pasted recipient, grant access, decrypt ciphertext, or re-encrypt files. The caller commits the public registry change for review.

An existing authorized developer completes onboarding with `gitvaulty group add <group> <username>`. The existing access-mutation transaction remains responsible for decrypting affected files, updating membership, re-encrypting ciphertext for the new exact recipient set, and rolling back on failure.

Keep `gitvaulty user add` for the existing interactive administrator workflow. Self-registration is a distinct command because registering a public identity and approving secret access are different security actions.

## README structure

Add a contents list immediately after the product overview. Expand Quick start into an end-to-end example that initializes a repository, imports a plaintext file, commits encrypted project state, registers a new developer without access, and has an authorized developer grant the default `team` group.

Add a Common workflows section for creating and importing files, editing, materializing, running commands, choosing access groups, onboarding, inspecting access, and offboarding. Examples use logical plaintext paths and show which generated files should be committed.

## Safety and testing

Self-registration must reject duplicate usernames and recipients through existing registry normalization. It must preserve all existing groups, file grants, and generated SOPS rules. Tests cover the zero-access operation, duplicate rejection, the CLI command surface, and argument forwarding. The full `npm run check` suite and Markdown link validation are the final verification gates.
