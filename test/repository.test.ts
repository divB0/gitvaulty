import path from "node:path";
import { describe, expect, it } from "vitest";

import { normalizeGitPath } from "../src/repository.js";

describe("repository paths", () => {
  it("normalizes Git's forward-slash output for Windows path comparisons", () => {
    expect(normalizeGitPath("D:/a/gitvaulty/gitvaulty", path.win32)).toBe("D:\\a\\gitvaulty\\gitvaulty");
  });
});
