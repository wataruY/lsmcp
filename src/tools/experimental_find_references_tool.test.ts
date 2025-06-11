import { describe, it, expect } from "vitest";
import { experimentalFindReferencesTool } from "./experimental_find_references_tool.ts";
import { resolve } from "path";

describe("experimentalFindReferencesTool", () => {
  const root = resolve(__dirname, "../..");

  it("should have correct tool definition", () => {
    expect(experimentalFindReferencesTool.name).toBe("experimental_find_references");
    expect(experimentalFindReferencesTool.description).toContain("references");
    expect(experimentalFindReferencesTool.inputSchema.required).toEqual([
      "root",
      "filePath",
      "line",
      "symbolName",
    ]);
  });

  it("should find references to a type", async () => {
    const result = await experimentalFindReferencesTool.handler({
      root,
      filePath: "examples/types.ts",
      line: 1,
      symbolName: "Value",
    });

    expect(result.isError).toBeFalsy();
    expect(result.content).toBeDefined();
    expect(result.content[0].text).toContain("Found");
    expect(result.content[0].text).toContain("reference");
  });

  it("should find references to a function", async () => {
    const result = await experimentalFindReferencesTool.handler({
      root,
      filePath: "examples/types.ts",
      line: 10,
      symbolName: "getValue",
    });

    expect(result.isError).toBeFalsy();
    expect(result.content).toBeDefined();
    expect(result.content[0].text).toContain("Found");
    expect(result.content[0].text).toContain("getValue");
  });

  it("should handle string line matching", async () => {
    const result = await experimentalFindReferencesTool.handler({
      root,
      filePath: "examples/types.ts",
      line: "ValueWithOptional",
      symbolName: "ValueWithOptional",
    });

    expect(result.isError).toBeFalsy();
    expect(result.content).toBeDefined();
    expect(result.content[0].text).toContain("ValueWithOptional");
  });

  it("should handle symbol not found on line", async () => {
    const result = await experimentalFindReferencesTool.handler({
      root,
      filePath: "examples/types.ts",
      line: 1,
      symbolName: "nonexistent",
    });

    expect(result.isError).toBeTruthy();
    expect(result.content[0].text).toContain("not found on line");
  });

  it("should handle line not found", async () => {
    const result = await experimentalFindReferencesTool.handler({
      root,
      filePath: "examples/types.ts",
      line: "nonexistent line",
      symbolName: "Value",
    });

    expect(result.isError).toBeTruthy();
    expect(result.content[0].text).toContain("Line containing");
    expect(result.content[0].text).toContain("not found");
  });

  it("should handle file not found", async () => {
    const result = await experimentalFindReferencesTool.handler({
      root,
      filePath: "nonexistent.ts",
      line: 1,
      symbolName: "test",
    });

    expect(result.isError).toBeTruthy();
    expect(result.content[0].text).toContain("Error:");
  });

  it("should include preview context in results", async () => {
    const result = await experimentalFindReferencesTool.handler({
      root,
      filePath: "examples/types.ts",
      line: 11,
      symbolName: "v",
    });

    expect(result.isError).toBeFalsy();
    if (result.content.length > 1) {
      const referencesText = result.content[1].text;
      // Should include preview lines
      expect(referencesText).toContain(":");
    }
  });

  it("should find references in the same file", async () => {
    // The Value type is defined and used in types.ts
    const result = await experimentalFindReferencesTool.handler({
      root,
      filePath: "examples/types.ts",
      line: 1,
      symbolName: "Value",
    });

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("Found");
    
    if (result.content.length > 1) {
      const referencesText = result.content[1].text;
      // Should find references to Value type
      expect(referencesText).toContain("types.ts");
    }
  });
});