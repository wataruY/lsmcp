import { defineConfig } from "vitest/config";

const isCI = process.env.CI === "true";

export default defineConfig({
  test: {
    includeSource: ["src/**/*.ts"],
    // Enable parallel test execution with shared LSP processes
    pool: isCI ? "forks" : "threads",
    silent: true,
    poolOptions: {
      threads: {
        minThreads: 2,
        maxThreads: 4,
      },
      forks: {
        singleFork: true, // Run all tests in a single process in CI
      },
    },
    globalSetup: "./tests/globalSetup.ts",
    // Increase timeout for CI environment
    testTimeout: isCI ? 30000 : 10000, // 30 seconds in CI, 10 seconds locally
    hookTimeout: isCI ? 30000 : 10000, // 30 seconds in CI, 10 seconds locally
    // Add hanging process reporter in CI to debug test hanging
    reporters: isCI ? ["default", "hanging-process"] : ["default"],
    // Force exit after tests complete in CI
    teardownTimeout: isCI ? 5000 : undefined,
  },
});
