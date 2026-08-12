import { describe, expect, it } from "vitest";

import { SessionStore } from "../src/session.js";

describe("document sessions", () => {
  it("reuses one session for a canonical source and stores no plaintext", () => {
    const sessions = new SessionStore();
    const first = sessions.getOrCreate({
      sourceUri: "file:///repo/.env.gitvaulty",
      virtualUri: "gitvaulty:/repo/.env?source=one",
      logicalPath: ".env",
    });
    const second = sessions.getOrCreate({
      sourceUri: "file:///repo/.env.gitvaulty",
      virtualUri: "gitvaulty:/repo/.env?source=one",
      logicalPath: ".env",
    });

    expect(second).toBe(first);
    expect(Object.keys(first).sort()).toEqual([
      "dirty",
      "fingerprint",
      "logicalPath",
      "saveQueue",
      "sourceUri",
      "virtualUri",
    ]);
    expect(sessions.byVirtualUri(first.virtualUri)).toBe(first);
  });

  it("deletes both indexes together", () => {
    const sessions = new SessionStore();
    const session = sessions.getOrCreate({
      sourceUri: "file:///repo/.env.gitvaulty",
      virtualUri: "gitvaulty:/repo/.env?source=one",
      logicalPath: ".env",
    });

    sessions.delete(session);

    expect(sessions.bySourceUri(session.sourceUri)).toBeUndefined();
    expect(sessions.byVirtualUri(session.virtualUri)).toBeUndefined();
  });
});
