import { describe, it, expect } from "vitest";
import { experimentalGetHoverTool } from "./experimental_get_hover.ts";
import { resolve } from "path";

describe("experimentalGetHoverTool", () => {
  const root = resolve(__dirname, "../..");

  it("should have correct tool definition", () => {
    expect(experimentalGetHoverTool.name).toBe("experimental_get_hover");
    expect(experimentalGetHoverTool.description).toContain("hover information");
    expect(experimentalGetHoverTool.inputSchema.required).toEqual([
      "root",
      "filePath",
      "line",
      "symbolName",
    ]);
  });

  it("should get hover information for a type", async () => {
    const result = await experimentalGetHoverTool.handler({
      root,
      filePath: "examples/types.ts",
      line: 1,
      symbolName: "Value",
    });

    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(2);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("Hover information for \"Value\"");
    expect(result.content[1].type).toBe("text");
    expect(result.content[1].text).toContain("type Value");
  });

  it("should get hover information using line string match", async () => {
    const result = await experimentalGetHoverTool.handler({
      root,
      filePath: "examples/types.ts",
      line: "ValueWithOptional",
      symbolName: "ValueWithOptional",
    });

    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(2);
    expect(result.content[1].text).toContain("type ValueWithOptional");
    expect(result.content[1].text).toContain("o?: string");
  });

  it("should get hover information for a function", async () => {
    const result = await experimentalGetHoverTool.handler({
      root,
      filePath: "examples/types.ts",
      line: 10,
      symbolName: "getValue",
    });

    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(2);
    expect(result.content[1].text).toContain("function getValue");
    expect(result.content[1].text).toContain("Value");
  });

  it("should handle no hover information gracefully", async () => {
    const result = await experimentalGetHoverTool.handler({
      root,
      filePath: "examples/types.ts",
      line: 3, // Empty line
      symbolName: "v",
    });

    // Even with no hover info, it should not be an error
    // The tool should handle this case gracefully
    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe("text");
  });

  it("should handle non-existent symbol error", async () => {
    const result = await experimentalGetHoverTool.handler({
      root,
      filePath: "examples/types.ts",
      line: 1,
      symbolName: "NonExistentSymbol",
    });

    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("Error:");
    expect(result.content[0].text).toContain("Symbol \"NonExistentSymbol\" not found");
  });

  it("should handle non-existent file error", async () => {
    const result = await experimentalGetHoverTool.handler({
      root,
      filePath: "examples/does-not-exist.ts",
      line: 1,
      symbolName: "something",
    });

    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("Error:");
    expect(result.content[0].text).toContain("ENOENT");
  });

  it("should handle line string not found error", async () => {
    const result = await experimentalGetHoverTool.handler({
      root,
      filePath: "examples/types.ts",
      line: "NonExistentLine",
      symbolName: "something",
    });

    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].text).toContain("Error:");
    expect(result.content[0].text).toContain("Line containing \"NonExistentLine\" not found");
  });
});