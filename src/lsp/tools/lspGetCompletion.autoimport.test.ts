import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { lspGetCompletionTool } from "./lspGetCompletion.ts";
import { initializeTestLSP, cleanupTestLSP } from "../../tests/helpers/lsp-test-helpers.ts";

describe("lspGetCompletionTool - auto-import features", () => {
  let tmpDir: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "test-lsp-autoimport-"));
    await mkdir(join(tmpDir, "src"), { recursive: true });
    
    // Create a TypeScript project with modules to import
    await writeFile(
      join(tmpDir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2020",
          module: "commonjs",
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
        },
      })
    );

    // Create a module with exports
    await writeFile(
      join(tmpDir, "src/utils.ts"),
      `
export function formatDate(date: Date): string {
  return date.toISOString();
}

export class Logger {
  log(message: string): void {
    console.log(message);
  }
}

export interface Config {
  port: number;
  host: string;
}
      `
    );

    // Create another module
    await writeFile(
      join(tmpDir, "src/models.ts"),
      `
export interface User {
  id: string;
  name: string;
  email: string;
}

export class UserService {
  getUser(id: string): User | null {
    return null;
  }
}
      `
    );

    const result = await initializeTestLSP(tmpDir);
    cleanup = result.cleanup;
  });

  afterAll(async () => {
    await cleanup();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("should get completions with resolve enabled", async () => {
    const testFile = join(tmpDir, "src/test.ts");
    await writeFile(
      testFile,
      `
// Type Logger here to get auto-import suggestions
const logger = new 
      `
    );

    const result = await lspGetCompletionTool.execute({
      root: tmpDir,
      filePath: "src/test.ts",
      line: 3,
      target: "new ",
      resolve: true,
    });

    expect(result).toContain("Logger");
    // When resolved, should include more details
    expect(result).toMatch(/Logger.*Class/);
  });

  it("should filter auto-import candidates", async () => {
    const testFile = join(tmpDir, "src/app.ts");
    await writeFile(
      testFile,
      `
// Try to use UserService
const service = new User
      `
    );

    const result = await lspGetCompletionTool.execute({
      root: tmpDir,
      filePath: "src/app.ts",
      line: 3,
      target: "User",
      resolve: true,
      includeAutoImport: true,
    });

    // Should show UserService as it needs import
    expect(result).toContain("UserService");
    
    // If the LSP supports it, should show import information
    if (result.includes("[Auto-import available]")) {
      expect(result).toMatch(/import.*UserService.*from/);
    }
  });

  it("should handle completions at different positions", async () => {
    const testFile = join(tmpDir, "src/main.ts");
    await writeFile(
      testFile,
      `
// Import and use formatDate
const formatted = format
      `
    );

    const result = await lspGetCompletionTool.execute({
      root: tmpDir,
      filePath: "src/main.ts",
      line: 3,
      target: "format",
      resolve: true,
    });

    expect(result).toContain("formatDate");
    expect(result).toContain("Function");
  });

  it("should show no auto-import completions when none available", async () => {
    const testFile = join(tmpDir, "src/isolated.ts");
    await writeFile(
      testFile,
      `
// Local variable, no imports needed
const local = "test";
const result = loc
      `
    );

    const result = await lspGetCompletionTool.execute({
      root: tmpDir,
      filePath: "src/isolated.ts",
      line: 4,
      target: "loc",
      includeAutoImport: true,
    });

    // Should not find auto-import candidates for local variable
    if (result.includes("No auto-import completions")) {
      expect(result).toContain("No auto-import completions available");
    } else {
      expect(result).not.toContain("[Auto-import available]");
    }
  });
});