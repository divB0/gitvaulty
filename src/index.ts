export { GitVaultyError } from "./errors.js";
export { normalizeUsername, parseRecipient } from "./recipient.js";
export { findRepository, type Repository } from "./repository.js";
export { createIdentity, currentRecipient, identityFile, readIdentity, readStoredIdentity, restoreIdentity, type StoredIdentity } from "./key.js";
export {
  normalizeGitVaultyUser,
  normalizeSecretFile,
  readRegistry,
  writeRegistry,
  recipientsFor,
  type Registry,
  type GitVaultyUser,
} from "./registry.js";
export {
  initialize,
  createSecretFile,
  importSecretFile,
  updateSecretFile,
  editSecretFile,
  addUser,
  removeUser,
  encryptedFileFor,
  plaintextFileFor,
  materializeSecretFiles,
  cleanSecretFiles,
  statusSecretFiles,
  runWithFiles,
  type CreatedSecretFile,
  type ImportedSecretFile,
  type EditConflictResolution,
  type SecretFileStatus,
  type CleanResult,
  type RunResult,
} from "./operations.js";
