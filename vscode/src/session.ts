export interface DocumentSession {
  sourceUri: string;
  virtualUri: string;
  logicalPath: string;
  fingerprint: string | undefined;
  dirty: boolean;
  saveQueue: Promise<void>;
}

export type NewDocumentSession = Pick<DocumentSession, "sourceUri" | "virtualUri" | "logicalPath">;

export class SessionStore {
  readonly #bySource = new Map<string, DocumentSession>();
  readonly #byVirtual = new Map<string, DocumentSession>();

  getOrCreate(input: NewDocumentSession): DocumentSession {
    const existing = this.#bySource.get(input.sourceUri);
    if (existing) {
      if (existing.virtualUri !== input.virtualUri || existing.logicalPath !== input.logicalPath) {
        throw new Error(`Conflicting GitVaulty session mapping for ${input.sourceUri}.`);
      }
      return existing;
    }
    const session: DocumentSession = {
      sourceUri: input.sourceUri,
      virtualUri: input.virtualUri,
      logicalPath: input.logicalPath,
      fingerprint: undefined,
      dirty: false,
      saveQueue: Promise.resolve(),
    };
    this.#bySource.set(session.sourceUri, session);
    this.#byVirtual.set(session.virtualUri, session);
    return session;
  }

  bySourceUri(uri: string): DocumentSession | undefined { return this.#bySource.get(uri); }

  byVirtualUri(uri: string): DocumentSession | undefined { return this.#byVirtual.get(uri); }

  delete(session: DocumentSession): void {
    if (this.#bySource.get(session.sourceUri) === session) this.#bySource.delete(session.sourceUri);
    if (this.#byVirtual.get(session.virtualUri) === session) this.#byVirtual.delete(session.virtualUri);
  }
}
