import { describe, it, expect } from "vitest";
import { experimentalFindReferencesTool } from "./experimental_find_references.ts";
import { resolve } from "path";

describe("experimentalFindReferencesTool", () => {
  const root = resolve(__dirname, "../..");

  it("should have correct tool definition", () => {
    expect(experimentalFindReferencesTool.name).toBe("experimental_find_references");
    expect(experimentalFindReferencesTool.description).toContain("references");
    expect(experimentalFindReferencesTool.schema.shape).toBeDefined();
    expect(experimentalFindReferencesTool.schema.shape.root).toBeDefined();
    expect(experimentalFindReferencesTool.schema.shape.filePath).toBeDefined();
    expect(experimentalFindReferencesTool.schema.shape.line).toBeDefined();
    expect(experimentalFindReferencesTool.schema.shape.symbolName).toBeDefined();
  });

  it("should find references to a type", async () => {
    const result = await experimentalFindReferencesTool.handler({
      root,
      filePath: "examples/types.ts",
      line: 1,
      symbolName: "Value",
    });

    expect(result).toContain("Found");
    expect(result).toContain("reference");
  });

  it("should find references to a function", async () => {
    const result = await experimentalFindReferencesTool.handler({
      root,
      filePath: "examples/types.ts",
      line: 10,
      symbolName: "getValue",
    });

    expect(result).toContain("Found");
    expect(result).toContain("getValue");
  });

  it("should handle string line matching", async () => {
    const result = await experimentalFindReferencesTool.handler({
      root,
      filePath: "examples/types.ts",
      line: "ValueWithOptional",
      symbolName: "ValueWithOptional",
    });

    expect(result).toContain("ValueWithOptional");
  });

  it("should handle symbol not found on line", async () => {
    await expect(
      experimentalFindReferencesTool.handler({
        root,
        filePath: "examples/types.ts",
        line: 1,
        symbolName: "nonexistent",
      })
    ).rejects.toThrow("not found on line");
  });

  it("should handle line not found", async () => {
    await expect(
      experimentalFindReferencesTool.handler({
        root,
        filePath: "examples/types.ts",
        line: "nonexistent line",
        symbolName: "Value",
      })
    ).rejects.toThrow("Line containing");
  });

  it("should handle file not found", async () => {
    await expect(
      experimentalFindReferencesTool.handler({
        root,
        filePath: "nonexistent.ts",
        line: 1,
        symbolName: "test",
      })
    ).rejects.toThrow();
  });

  it("should include preview context in results", async () => {
    const result = await experimentalFindReferencesTool.handler({
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
    const result = await experimentalFindReferencesTool.handler({
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