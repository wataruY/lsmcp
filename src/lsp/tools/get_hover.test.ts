import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { lspGetHoverTool } from "./get_hover.ts";
import { resolve } from "path";
import { spawn } from "child_process";
import { initialize, shutdown } from "../lsp_client.ts";

describe("experimentalGetHoverTool", () => {
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
    expect(lspGetHoverTool.name).toBe("lsp_get_hover");
    expect(lspGetHoverTool.description).toContain("hover information");
    expect(lspGetHoverTool.schema.shape).toBeDefined();
    expect(lspGetHoverTool.schema.shape.root).toBeDefined();
    expect(lspGetHoverTool.schema.shape.filePath).toBeDefined();
    expect(lspGetHoverTool.schema.shape.line).toBeDefined();
    expect(lspGetHoverTool.schema.shape.target).toBeDefined();
  });

  it("should get hover information for a type", async () => {
    const result = await lspGetHoverTool.handler({
      root,
      filePath: "examples/types.ts",
      line: 1,
      target: "Value",
    });

    expect(result).toContain('Hover information for "Value"');
    expect(result).toContain("type Value");
  });

  it("should get hover information using line string match", async () => {
    const result = await lspGetHoverTool.handler({
      root,
      filePath: "examples/types.ts",
      line: "ValueWithOptional",
      target: "ValueWithOptional",
    });

    expect(result).toContain("type ValueWithOptional");
    expect(result).toContain("o?: string");
  });

  it("should get hover information for a function", async () => {
    const result = await lspGetHoverTool.handler({
      root,
      filePath: "examples/types.ts",
      line: 10,
      target: "getValue",
    });

    expect(result).toContain("function getValue");
    expect(result).toContain("Value");
  });

  it("should handle no hover information gracefully", async () => {
    await expect(
      lspGetHoverTool.handler({
        root,
        filePath: "examples/types.ts",
        line: 3, // Empty line
        target: "v",
      })
    ).rejects.toThrow('Symbol "v" not found');
  });

  it("should handle non-existent symbol error", async () => {
    await expect(
      lspGetHoverTool.handler({
        root,
        filePath: "examples/types.ts",
        line: 1,
        target: "NonExistentSymbol",
      })
    ).rejects.toThrow('Symbol "NonExistentSymbol" not found');
  });

  it("should handle non-existent file error", async () => {
    await expect(
      lspGetHoverTool.handler({
        root,
        filePath: "examples/does-not-exist.ts",
        line: 1,
        target: "something",
      })
    ).rejects.toThrow("ENOENT");
  });

  it("should handle line string not found error", async () => {
    await expect(
      lspGetHoverTool.handler({
        root,
        filePath: "examples/types.ts",
        line: "NonExistentLine",
        target: "something",
      })
    ).rejects.toThrow('Line containing "NonExistentLine" not found');
  });

  it("should get hover information without line specified", async () => {
    const result = await lspGetHoverTool.handler({
      root,
      filePath: "examples/types.ts",
      target: "Value",
    });

    expect(result).toContain('Hover information for "Value"');
    expect(result).toContain("type Value");
  });
});
