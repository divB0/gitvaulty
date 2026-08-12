export class GitVaultyError extends Error {
  override name = "GitVaultyError";
}

export class TrackedPlaintextError extends GitVaultyError {
  override name = "TrackedPlaintextError";

  constructor(readonly file: string) {
    super(`Git-tracked plaintext cannot be imported safely: ${file}`);
  }
}
