export class GitVaultyError extends Error {
  override name = "GitVaultyError";
}

export class TrackedPlaintextError extends GitVaultyError {
  override name = "TrackedPlaintextError";

  constructor(readonly file: string) {
    super(`Git-tracked plaintext cannot be imported safely: ${file}`);
  }
}

export class SecretFileConflictError extends GitVaultyError {
  override name = "SecretFileConflictError";

  constructor(readonly file: string) {
    super(`Encrypted file changed while it was open: ${file}`);
  }
}
