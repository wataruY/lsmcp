import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
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
