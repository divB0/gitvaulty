# Interactive tracked-file import design

## Goal

Let `gitvaulty import <path>` safely recover when the plaintext path is currently tracked by Git. The command asks before changing the index, preserves the working file, stages its removal from tracking, and then completes the existing encrypted and verified import. It does not claim to erase prior commits or rotate credentials.

## User experience

The first import attempt continues to perform all existing validation. When it reaches a tracked plaintext file, the CLI explains that the contents may already exist in Git history and that exposed credentials still need rotation. It then asks, with a default answer of no, whether to stop tracking the file and continue.

Declining cancels the import without changing the index or creating encrypted output. Accepting adds the plaintext path to the clone-local Git exclude file, runs `git rm --cached -- <path>` without force, and retries the normal import. The working file remains in place. Git stages a deletion for a file already committed in the current history; users can review that deletion together with the new encrypted file before committing.

The same recovery applies to `gitvaulty import --update`, because a materialized plaintext file can accidentally be added back to Git after its initial import.

## Architecture and safety

The operations layer keeps refusing tracked plaintext by default. It raises a dedicated `TrackedPlaintextError` containing the normalized repository-relative path. This lets the CLI distinguish the recoverable tracked-file condition from every other import failure without matching error text.

An exported operations helper performs the explicit untracking action. It normalizes the requested path with the same path-safety rules used by import, writes the local exclusion first, and invokes Git with an argument separator. It deliberately omits `--force`; unusual index states should stop and surface Git's error rather than discard an intermediate staged version.

The CLI owns the prompt and retry. Tests inject the confirmation decision so they can verify both branches without driving a terminal. Existing direct callers of `importSecretFile` and `updateSecretFile` remain protected and still receive an error for tracked input.

## Testing and documentation

Focused tests cover declining (no index or encrypted-file changes), accepting (working plaintext preserved, index removal staged, encrypted bytes correct, local exclusion written), and direct operation refusal. The README migration section documents the prompt, staged deletion, lack of history rewriting, and credential-rotation requirement.
