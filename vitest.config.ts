import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    includeSource: ["src/**/*.{ts}"],
    // Enable parallel test execution with shared LSP processes
    pool: "threads",
    silent: true,
    poolOptions: {
      threads: {
        minThreads: 2,
        maxThreads: 4,
      },
    },
    globalSetup: "./vitest.global-setup.ts",
  },
});
