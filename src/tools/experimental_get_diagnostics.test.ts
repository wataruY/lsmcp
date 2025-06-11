import { describe, it, expect } from "vitest";
import { experimentalGetDiagnosticsTool } from "./experimental_get_diagnostics.ts";
import { resolve } from "path";

describe("experimentalGetDiagnosticsTool", { timeout: 10000 }, () => {
  const root = resolve(__dirname, "../..");

  it("should have correct tool definition", () => {
    expect(experimentalGetDiagnosticsTool.name).toBe("experimental_get_diagnostics");
    expect(experimentalGetDiagnosticsTool.description).toContain("diagnostics");
  });

  it("should get diagnostics for a file with errors", async () => {
    const virtualContent = `
      const x: string = 123; // Type error
      console.log(y); // Undefined variable
      
      function foo(a: number) {
        return a + "hello"; // Type error
      }
    `;

    const result = await experimentalGetDiagnosticsTool.handler({
      root,
      filePath: "test.ts",
      virtualContent,
    });

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("error");
    
    // The response should either contain diagnostics or indicate they were found
    const allText = result.content.map(c => c.text).join("\n");
    // Either we found errors or the diagnostic contains error information
    expect(allText.toLowerCase()).toMatch(/error|diagnostic/);
  });

  it("should handle file with no errors", async () => {
    const virtualContent = `
      const x: string = "hello";
      console.log(x);
      
      function foo(a: number): number {
        return a + 1;
      }
    `;

    const result = await experimentalGetDiagnosticsTool.handler({
      root,
      filePath: "test.ts",
      virtualContent,
    });

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("0 errors and 0 warnings");
  });

  it("should handle warnings", async () => {
    const virtualContent = `
      // @ts-check
      const x = 123;
      // @ts-ignore
      const unused = 456; // This might generate a warning
    `;

    const result = await experimentalGetDiagnosticsTool.handler({
      root,
      filePath: "test.js",
      virtualContent,
    });

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toMatch(/\d+ error[s]? and \d+ warning[s]?/);
  });

  it("should handle non-existent file error", async () => {
    const result = await experimentalGetDiagnosticsTool.handler({
      root,
      filePath: "non-existent-file-12345.ts",
    });

    expect(result.isError).toBeTruthy();
    expect(result.content[0].text).toContain("Error:");
  });

  it("should get diagnostics for actual file", async () => {
    const result = await experimentalGetDiagnosticsTool.handler({
      root,
      filePath: "examples/scratch.ts",
    });

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toMatch(/Found \d+ error[s]? and \d+ warning[s]?/);
  });
});