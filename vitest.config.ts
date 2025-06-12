import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    includeSource: ["src/**/*.{ts}"],
    // Run tests sequentially to avoid race conditions with file system operations
    pool: "forks",
    silent: true,
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
