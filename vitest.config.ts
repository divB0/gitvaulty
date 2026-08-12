import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: { reporter: ["text", "html"] },
    exclude: [...configDefaults.exclude, ".worktrees/**"],
  },
});
