import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Server modules guard themselves with `server-only`, which throws
      // outside a Next server bundle. Stub it so their pure logic is testable.
      "server-only": fileURLToPath(
        new URL("./src/services/jira/server-only-stub.ts", import.meta.url),
      ),
    },
  },
});
