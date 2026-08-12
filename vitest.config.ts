import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: { reporter: ["text", "html"] },
    exclude: [...configDefaults.exclude, ".worktrees/**"],
  },
});
