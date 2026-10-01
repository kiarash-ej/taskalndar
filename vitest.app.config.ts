import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Not named vitest.config.ts: Vitest looks for that name in parent directories
// too, and would then take over packages/core's own test run.

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // packages/core runs its own suite (npm test --workspace @taskalndar/core).
    include: ["src/**/*.test.ts"],
  },
});
