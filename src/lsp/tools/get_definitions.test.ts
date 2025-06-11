import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { lspGetDefinitionsTool } from "./get_definitions.ts";
import { resolve } from "path";
import { spawn } from "child_process";
import { initialize, shutdown } from "../lsp_client.ts";

describe("experimentalGetDefinitionsTool", () => {
  const root = resolve(__dirname, "../../..");
  
  beforeAll(async () => {
    // Initialize LSP client for tests
    const process = spawn("npx", ["typescript-language-server", "--stdio"], {
      cwd: root,
      stdio: ["pipe", "pipe", "pipe"],
    });
    await initialize(root, process);
  });
  
  afterAll(async () => {
    await shutdown();
  });

  it("should have correct tool definition", () => {
    expect(lspGetDefinitionsTool.name).toBe("lsp_get_definitions");
    expect(lspGetDefinitionsTool.description).toContain("definition");
    expect(lspGetDefinitionsTool.schema).toBeDefined();
  });

  it("should find definition of an exported symbol", async () => {
    // Using the example connected.ts file which imports from "./scratch"
    const result = await lspGetDefinitionsTool.handler({
      root,
      filePath: "examples/connected.ts",
      line: 1, // export line
      symbolName: "x",
    });

    expect(result).toContain("Found");
    expect(result).toContain("definition");
  });

  it.skip("should find definition of a type in the same project", async () => {
    // The types.ts file has Value type used in getValue function
    const result = await lspGetDefinitionsTool.handler({
      root,
      filePath: "examples/types.ts",
      line: 10, // getValue function that returns Value type
      symbolName: "Value",
    });

    expect(result).toContain("Found");
  });

  it.skip("should handle string line matching", async () => {
    const result = await lspGetDefinitionsTool.handler({
      root,
      filePath: "examples/types.ts",
      line: "ValueWithOptional",
      symbolName: "ValueWithOptional",
    });

    expect(result).toContain("ValueWithOptional");
  });

  it("should handle symbol not found on line", async () => {
    await expect(
      lspGetDefinitionsTool.handler({
        root,
        filePath: "examples/types.ts",
        line: 1,
        symbolName: "nonexistent",
      })
    ).rejects.toThrow('Symbol "nonexistent" not found on line');
  });

  it("should handle line not found", async () => {
    await expect(
      lspGetDefinitionsTool.handler({
        root,
        filePath: "examples/types.ts",
        line: "nonexistent line",
        symbolName: "Value",
      })
    ).rejects.toThrow('Line containing "nonexistent line" not found');
  });

  it("should handle file not found", async () => {
    await expect(
      lspGetDefinitionsTool.handler({
        root,
        filePath: "nonexistent.ts",
        line: 1,
        symbolName: "test",
      })
    ).rejects.toThrow();
  });

  it.skip("should handle no definition found for built-in symbols", async () => {
    const result = await lspGetDefinitionsTool.handler({
      root,
      filePath: "examples/types.ts",
      line: 11, // The return statement line
      symbolName: "v",
      before: 2,
      after: 2,
    });

    // Local variable might have definition or might not, depending on LSP
    expect(result).toContain("Found");
    expect(result).toContain("definition");
  });
});
