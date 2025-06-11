import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { lspFindReferencesTool } from "./lsp_find_references.ts";
import { resolve } from "path";
import { spawn } from "child_process";
import { initialize, shutdown } from "../lsp_client.ts";

describe("experimentalFindReferencesTool", () => {
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
    expect(lspFindReferencesTool.name).toBe("lsp_find_references");
    expect(lspFindReferencesTool.description).toContain("references");
    expect(lspFindReferencesTool.schema.shape).toBeDefined();
    expect(lspFindReferencesTool.schema.shape.root).toBeDefined();
    expect(lspFindReferencesTool.schema.shape.filePath).toBeDefined();
    expect(lspFindReferencesTool.schema.shape.line).toBeDefined();
    expect(lspFindReferencesTool.schema.shape.symbolName).toBeDefined();
  });

  it("should find references to a type", async () => {
    const result = await lspFindReferencesTool.handler({
      root,
      filePath: "examples/types.ts",
      line: 1,
      symbolName: "Value",
    });

    expect(result).toContain("Found");
    expect(result).toContain("reference");
  });

  it("should find references to a function", async () => {
    const result = await lspFindReferencesTool.handler({
      root,
      filePath: "examples/types.ts",
      line: 10,
      symbolName: "getValue",
    });

    expect(result).toContain("Found");
    expect(result).toContain("getValue");
  });

  it("should handle string line matching", async () => {
    const result = await lspFindReferencesTool.handler({
      root,
      filePath: "examples/types.ts",
      line: "ValueWithOptional",
      symbolName: "ValueWithOptional",
    });

    expect(result).toContain("ValueWithOptional");
  });

  it("should handle symbol not found on line", async () => {
    await expect(
      lspFindReferencesTool.handler({
        root,
        filePath: "examples/types.ts",
        line: 1,
        symbolName: "nonexistent",
      })
    ).rejects.toThrow("not found on line");
  });

  it("should handle line not found", async () => {
    await expect(
      lspFindReferencesTool.handler({
        root,
        filePath: "examples/types.ts",
        line: "nonexistent line",
        symbolName: "Value",
      })
    ).rejects.toThrow("Line containing");
  });

  it("should handle file not found", async () => {
    await expect(
      lspFindReferencesTool.handler({
        root,
        filePath: "nonexistent.ts",
        line: 1,
        symbolName: "test",
      })
    ).rejects.toThrow();
  });

  it("should include preview context in results", async () => {
    const result = await lspFindReferencesTool.handler({
      root,
      filePath: "examples/types.ts",
      line: 11,
      symbolName: "v",
    });

    // Should include preview lines with colon separator
    expect(result).toContain(":");
  });

  it("should find references in the same file", async () => {
    // The Value type is defined and used in types.ts
    const result = await lspFindReferencesTool.handler({
      root,
      filePath: "examples/types.ts",
      line: 1,
      symbolName: "Value",
    });

    expect(result).toContain("Found");
    // Should find references to Value type
    expect(result).toContain("types.ts");
  });
});
