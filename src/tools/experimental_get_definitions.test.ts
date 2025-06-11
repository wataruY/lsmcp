import { describe, it, expect } from "vitest";
import { experimentalGetDefinitionsTool } from "./experimental_get_definitions.ts";
import { resolve } from "path";

describe("experimentalGetDefinitionsTool", () => {
  const root = resolve(__dirname, "../..");

  it("should have correct tool definition", () => {
    expect(experimentalGetDefinitionsTool.name).toBe("experimental_get_definitions");
    expect(experimentalGetDefinitionsTool.description).toContain("definition");
    expect(experimentalGetDefinitionsTool.inputSchema.required).toEqual([
      "root",
      "filePath",
      "line",
      "symbolName",
    ]);
  });

  it("should find definition of an exported symbol", async () => {
    // Using the example connected.ts file which imports from "./scratch"
    const result = await experimentalGetDefinitionsTool.handler({
      root,
      filePath: "examples/connected.ts",
      line: 1, // export line
      symbolName: "x",
    });

    expect(result.isError).toBeFalsy();
    expect(result.content).toBeDefined();
    expect(result.content[0].text).toContain("Found");
    expect(result.content[0].text).toContain("definition");
  });

  it.skip("should find definition of a type in the same project", async () => {
    // The types.ts file has Value type used in getValue function
    const result = await experimentalGetDefinitionsTool.handler({
      root,
      filePath: "examples/types.ts",
      line: 10, // getValue function that returns Value type
      symbolName: "Value",
    });

    expect(result.isError).toBeFalsy();
    expect(result.content).toBeDefined();
    expect(result.content[0].text).toContain("Found");
  });

  it.skip("should handle string line matching", async () => {
    const result = await experimentalGetDefinitionsTool.handler({
      root,
      filePath: "examples/types.ts",
      line: "ValueWithOptional",
      symbolName: "ValueWithOptional",
    });

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("ValueWithOptional");
  });

  it("should handle symbol not found on line", async () => {
    const result = await experimentalGetDefinitionsTool.handler({
      root,
      filePath: "examples/types.ts",
      line: 1,
      symbolName: "nonexistent",
    });

    expect(result.isError).toBeTruthy();
    expect(result.content[0].text).toContain("not found on line");
  });

  it("should handle line not found", async () => {
    const result = await experimentalGetDefinitionsTool.handler({
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
    const result = await experimentalGetDefinitionsTool.handler({
      root,
      filePath: "nonexistent.ts",
      line: 1,
      symbolName: "test",
    });

    expect(result.isError).toBeTruthy();
    expect(result.content[0].text).toContain("Error:");
  });

  it.skip("should handle no definition found for built-in symbols", async () => {
    const result = await experimentalGetDefinitionsTool.handler({
      root,
      filePath: "examples/types.ts",
      line: 11, // The return statement line
      symbolName: "v",
      before: 2,
      after: 2,
    });

    expect(result.isError).toBeFalsy();
    // Local variable might have definition or might not, depending on LSP
    expect(result.content[0].text).toContain("Found");
    expect(result.content[0].text).toContain("definition");
  });
});