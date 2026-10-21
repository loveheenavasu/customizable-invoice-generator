import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(dirname, "src"),
      // `server-only` throws outside Next's server bundle; tests run in plain Node.
      "server-only": path.resolve(dirname, "tests/support/server-only.ts"),
    },
  },
  // Compile JSX for component tests (tsconfig keeps it as "preserve" for Next).
  esbuild: { jsx: "automatic" },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/support/setup.ts"],
    environment: "node",
  },
});
