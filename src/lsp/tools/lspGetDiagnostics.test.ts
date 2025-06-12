import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { lspGetDiagnosticsTool } from "./lspGetDiagnostics.ts";
import { resolve } from "path";
import { setupLSPForTest, teardownLSPForTest } from "../testHelpers.ts";

describe("lspGetDiagnosticsTool", { timeout: 10000 }, () => {
  const root = resolve(__dirname, "../../..");
  
  beforeAll(async () => {
    await setupLSPForTest(root);
  });
  
  afterAll(async () => {
    await teardownLSPForTest();
  });

  it("should have correct tool definition", () => {
    expect(lspGetDiagnosticsTool.name).toBe("lsp_get_diagnostics");
    expect(lspGetDiagnosticsTool.description).toContain("diagnostics");
  });

  it("should get diagnostics for a file with errors", async () => {
    const virtualContent = `
      const x: string = 123; // Type error
      console.log(y); // Undefined variable
      
      function foo(a: number) {
        return a + "hello"; // Type error
      }
    `;

    const result = await lspGetDiagnosticsTool.execute({
      root,
      filePath: "test.ts",
      virtualContent,
    });

    expect(result).toContain("error");
    // Should find multiple errors
    expect(result.toLowerCase()).toMatch(/\d+ errors?/);
  });

  it("should handle file with no errors", async () => {
    const virtualContent = `
      const x: string = "hello";
      console.log(x);
      
      function foo(a: number): number {
        return a + 1;
      }
    `;

    const result = await lspGetDiagnosticsTool.execute({
      root,
      filePath: "test.ts",
      virtualContent,
    });

    expect(result).toContain("0 errors and 0 warnings");
  });

  it("should handle warnings", async () => {
    const virtualContent = `
      // @ts-check
      const x = 123;
      // @ts-ignore
      const unused = 456; // This might generate a warning
    `;

    const result = await lspGetDiagnosticsTool.execute({
      root,
      filePath: "test.js",
      virtualContent,
    });

    expect(result).toMatch(/\d+ errors? and \d+ warnings?/);
  });

  it("should handle non-existent file error", async () => {
    await expect(
      lspGetDiagnosticsTool.execute({
        root,
        filePath: "non-existent-file-12345.ts",
      })
    ).rejects.toThrow("ENOENT");
  });

  it("should get diagnostics for actual file", async () => {
    const result = await lspGetDiagnosticsTool.execute({
      root,
      filePath: "playground/scratch.ts",
    });

    expect(result).toMatch(/Found \d+ errors? and \d+ warnings?/);
  });
});
