export { GitVaultyError } from "./errors.js";
export { normalizeUsername, parseRecipient, type ParsedRecipient, type RecipientType } from "./recipient.js";
export { findRepository, validateName, type Repository } from "./repository.js";
export { createIdentity, currentRecipient, identityFile, readIdentity, restoreIdentity, type StoredIdentity } from "./key.js";
export { normalizeVaultUser, readRegistry, writeRegistry, recipientsFor, type Registry, type VaultUser } from "./registry.js";
export { initialize, createVault, edit, addUser, removeUser, vaultData, runWithVault } from "./operations.js";
export { renderTemplate, renderInMemory, renderVault, checkVault, type RenderedFile } from "./templates.js";
