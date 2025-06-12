import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { lspGetHoverTool } from "./lspGetHover.ts";
import { resolve } from "path";

import { setupLSPForTest, teardownLSPForTest } from "../testHelpers.ts";

describe("lspGetHoverTool", () => {
  const root = resolve(__dirname, "../../..");
  
  beforeAll(async () => {
    await setupLSPForTest(root);
  });
  
  afterAll(async () => {
    await teardownLSPForTest();
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
    const result = await lspGetHoverTool.execute({
      root,
      filePath: "playground/types.ts",
      line: 1,
      target: "Value",
    });

    expect(result).toContain('Hover information for "Value"');
    expect(result).toContain("type Value");
  });

  it("should get hover information using line string match", async () => {
    const result = await lspGetHoverTool.execute({
      root,
      filePath: "playground/types.ts",
      line: "ValueWithOptional",
      target: "ValueWithOptional",
    });

    expect(result).toContain("type ValueWithOptional");
    expect(result).toContain("o?: string");
  });

  it("should get hover information for a function", async () => {
    const result = await lspGetHoverTool.execute({
      root,
      filePath: "playground/types.ts",
      line: 10,
      target: "getValue",
    });

    expect(result).toContain("function getValue");
    expect(result).toContain("Value");
  });

  it("should handle no hover information gracefully", async () => {
    await expect(
      lspGetHoverTool.execute({
        root,
        filePath: "playground/types.ts",
        line: 3, // Empty line
        target: "v",
      })
    ).rejects.toThrow('Symbol "v" not found');
  });

  it("should handle non-existent symbol error", async () => {
    await expect(
      lspGetHoverTool.execute({
        root,
        filePath: "playground/types.ts",
        line: 1,
        target: "NonExistentSymbol",
      })
    ).rejects.toThrow('Symbol "NonExistentSymbol" not found');
  });

  it("should handle non-existent file error", async () => {
    await expect(
      lspGetHoverTool.execute({
        root,
        filePath: "playground/does-not-exist.ts",
        line: 1,
        target: "something",
      })
    ).rejects.toThrow("ENOENT");
  });

  it("should handle line string not found error", async () => {
    await expect(
      lspGetHoverTool.execute({
        root,
        filePath: "playground/types.ts",
        line: "NonExistentLine",
        target: "something",
      })
    ).rejects.toThrow('Line containing "NonExistentLine" not found');
  });

  it("should get hover information without line specified", async () => {
    const result = await lspGetHoverTool.execute({
      root,
      filePath: "playground/types.ts",
      target: "Value",
    });

    expect(result).toContain('Hover information for "Value"');
    expect(result).toContain("type Value");
  });
});

// @typescript/native-preview
describe("lspGetHoverTool with fresh LSP instance", () => {
  const root = resolve(__dirname, "../../..");
  
  beforeAll(async () => {
    await setupLSPForTest(root);
  });
  
  afterAll(async () => {
    await teardownLSPForTest();
  });

  it("should get hover for property in object type", async () => {
    const result = await lspGetHoverTool.execute({
      root,
      filePath: "playground/types.ts",
      line: 2,
      target: "v",
    });

    expect(result).toContain("(property) v: string");
  });

  it("should get hover for optional property", async () => {
    const result = await lspGetHoverTool.execute({
      root,
      filePath: "playground/types.ts",
      line: 7,
      target: "o",
    });

    expect(result).toContain("(property) o?: string");
  });

  it("should get hover for return statement", async () => {
    const result = await lspGetHoverTool.execute({
      root,
      filePath: "playground/types.ts",
      line: 11,
      target: "return",
    });

    expect(result).toContain("return");
  });

  it("should find first occurrence when target appears multiple times", async () => {
    const result = await lspGetHoverTool.execute({
      root,
      filePath: "playground/types.ts",
      target: "string",
    });

    // Should find the first "string" in the file
    expect(result).toContain("string");
  });

  it("should handle complex target search without line", async () => {
    const result = await lspGetHoverTool.execute({
      root,
      filePath: "playground/types.ts",
      target: "getValue",
    });

    expect(result).toContain("function getValue(): Value");
  });

  it("should return hover with range information", async () => {
    const result = await lspGetHoverTool.execute({
      root,
      filePath: "playground/types.ts",
      line: 5,
      target: "ValueWithOptional",
    });

    // The result should contain hover information
    expect(result).toBeTruthy();
    expect(result).toContain("Hover information");
    expect(result).toContain("ValueWithOptional");
  });
});
