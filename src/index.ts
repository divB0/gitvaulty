export { GitVaultyError } from "./errors.js";
export { findRepository, validateName, type Repository } from "./repository.js";
export { generateKey, importKey, readIdentity, currentRecipient } from "./key.js";
export { readRegistry, writeRegistry, recipientsFor, type Registry, type VaultUser } from "./registry.js";
export { initialize, createVault, edit, addUser, removeUser, vaultData, runWithVault } from "./operations.js";
export { renderTemplate, renderInMemory, renderVault, checkVault, type RenderedFile } from "./templates.js";

