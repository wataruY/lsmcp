import { describe, it, expect } from "vitest";
import { experimentalGetHoverTool } from "./experimental_get_hover.ts";
import { resolve } from "path";

describe("experimentalGetHoverTool", () => {
  const root = resolve(__dirname, "../..");

  it("should have correct tool definition", () => {
    expect(experimentalGetHoverTool.name).toBe("experimental_get_hover");
    expect(experimentalGetHoverTool.description).toContain("hover information");
    expect(experimentalGetHoverTool.schema.shape).toBeDefined();
    expect(experimentalGetHoverTool.schema.shape.root).toBeDefined();
    expect(experimentalGetHoverTool.schema.shape.filePath).toBeDefined();
    expect(experimentalGetHoverTool.schema.shape.line).toBeDefined();
    expect(experimentalGetHoverTool.schema.shape.target).toBeDefined();
  });

  it("should get hover information for a type", async () => {
    const result = await experimentalGetHoverTool.handler({
      root,
      filePath: "examples/types.ts",
      line: 1,
      target: "Value",
    });

    expect(result).toContain("Hover information for \"Value\"");
    expect(result).toContain("type Value");
  });

  it("should get hover information using line string match", async () => {
    const result = await experimentalGetHoverTool.handler({
      root,
      filePath: "examples/types.ts",
      line: "ValueWithOptional",
      target: "ValueWithOptional",
    });

    expect(result).toContain("type ValueWithOptional");
    expect(result).toContain("o?: string");
  });

  it("should get hover information for a function", async () => {
    const result = await experimentalGetHoverTool.handler({
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
      experimentalGetHoverTool.handler({
        root,
        filePath: "examples/types.ts",
        line: 3, // Empty line
        target: "v",
      })
    ).rejects.toThrow("Symbol \"v\" not found");
  });

  it("should handle non-existent symbol error", async () => {
    await expect(
      experimentalGetHoverTool.handler({
        root,
        filePath: "examples/types.ts",
        line: 1,
        target: "NonExistentSymbol",
      })
    ).rejects.toThrow("Symbol \"NonExistentSymbol\" not found");
  });

  it("should handle non-existent file error", async () => {
    await expect(
      experimentalGetHoverTool.handler({
        root,
        filePath: "examples/does-not-exist.ts",
        line: 1,
        target: "something",
      })
    ).rejects.toThrow("ENOENT");
  });

  it("should handle line string not found error", async () => {
    await expect(
      experimentalGetHoverTool.handler({
        root,
        filePath: "examples/types.ts",
        line: "NonExistentLine",
        target: "something",
      })
    ).rejects.toThrow("Line containing \"NonExistentLine\" not found");
  });

  it("should get hover information without line specified", async () => {
    const result = await experimentalGetHoverTool.handler({
      root,
      filePath: "examples/types.ts",
      target: "Value",
    });

    expect(result).toContain("Hover information for \"Value\"");
    expect(result).toContain("type Value");
  });
});