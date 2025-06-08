import { describe, it, expect } from "vitest";
import { Project } from "ts-morph";
import { resolveLineParameter } from "./line_utils.ts";

describe("resolveLineParameter", () => {
  it("should accept a line number directly", () => {
    const project = new Project();
    const sourceFile = project.createSourceFile(
      "test.ts",
      `const foo = 1;
const bar = 2;
const baz = 3;`
    );

    const result = resolveLineParameter(sourceFile, 2);
    expect(result).toBe(2);
  });

  it("should find a line by string match", () => {
    const project = new Project();
    const sourceFile = project.createSourceFile(
      "test.ts",
      `const foo = 1;
const bar = 2;
const baz = 3;`
    );

    const result = resolveLineParameter(sourceFile, "bar = 2");
    expect(result).toBe(2);
  });

  it("should throw error if string not found", () => {
    const project = new Project();
    const sourceFile = project.createSourceFile(
      "test.ts",
      `const foo = 1;
const bar = 2;
const baz = 3;`
    );

    expect(() => resolveLineParameter(sourceFile, "not found")).toThrow(
      'No line found containing: "not found"'
    );
  });

  it("should throw error if multiple lines match", () => {
    const project = new Project();
    const sourceFile = project.createSourceFile(
      "test.ts",
      `const foo = 1;
const foo2 = 2;
const bar = 3;`
    );

    expect(() => resolveLineParameter(sourceFile, "const foo")).toThrow(
      /Multiple lines found containing "const foo"/
    );
  });

  it("should throw error for invalid line number", () => {
    const project = new Project();
    const sourceFile = project.createSourceFile(
      "test.ts",
      `const foo = 1;`
    );

    expect(() => resolveLineParameter(sourceFile, 0)).toThrow(
      "Invalid line number: 0"
    );
    
    expect(() => resolveLineParameter(sourceFile, 10)).toThrow(
      "Invalid line number: 10"
    );
  });
});