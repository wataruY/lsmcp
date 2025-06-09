import { describe, it, expect } from "vitest";
import { Project } from "ts-morph";
import { resolveLineParameter, findSymbolInLine } from "./line_utils.ts";

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

describe("findSymbolInLine", () => {
  it("should find symbol and return column position", () => {
    const project = new Project();
    const sourceFile = project.createSourceFile(
      "test.ts",
      `const foo = 1;
function bar() {
  return foo + 2;
}`
    );

    const result = findSymbolInLine(sourceFile, 1, "foo");
    expect(result).toEqual({
      lineText: "const foo = 1;",
      column: 7
    });
  });

  it("should find symbol at beginning of line", () => {
    const project = new Project();
    const sourceFile = project.createSourceFile(
      "test.ts",
      `function test() {
  return 42;
}`
    );

    const result = findSymbolInLine(sourceFile, 1, "function");
    expect(result).toEqual({
      lineText: "function test() {",
      column: 1
    });
  });

  it("should throw error if symbol not found on line", () => {
    const project = new Project();
    const sourceFile = project.createSourceFile(
      "test.ts",
      `const foo = 1;
const bar = 2;`
    );

    expect(() => findSymbolInLine(sourceFile, 1, "bar")).toThrow(
      'Symbol "bar" not found on line 1'
    );
  });

  it("should throw error for invalid line number", () => {
    const project = new Project();
    const sourceFile = project.createSourceFile(
      "test.ts",
      `const foo = 1;`
    );

    expect(() => findSymbolInLine(sourceFile, 0, "foo")).toThrow(
      "Invalid line number: 0"
    );
    
    expect(() => findSymbolInLine(sourceFile, 10, "foo")).toThrow(
      "Invalid line number: 10"
    );
  });

  it("should find first occurrence of symbol by default", () => {
    const project = new Project();
    const sourceFile = project.createSourceFile(
      "test.ts",
      `const foo = foo + foo;`
    );

    const result = findSymbolInLine(sourceFile, 1, "foo");
    expect(result).toEqual({
      lineText: "const foo = foo + foo;",
      column: 7  // First occurrence
    });
  });

  it("should find specific occurrence with index", () => {
    const project = new Project();
    const sourceFile = project.createSourceFile(
      "test.ts",
      `const foo = foo + foo;`
    );

    // Find second occurrence (index = 1)
    const result1 = findSymbolInLine(sourceFile, 1, "foo", 1);
    expect(result1).toEqual({
      lineText: "const foo = foo + foo;",
      column: 13  // Second occurrence
    });

    // Find third occurrence (index = 2)
    const result2 = findSymbolInLine(sourceFile, 1, "foo", 2);
    expect(result2).toEqual({
      lineText: "const foo = foo + foo;",
      column: 19  // Third occurrence
    });
  });

  it("should throw error for invalid index", () => {
    const project = new Project();
    const sourceFile = project.createSourceFile(
      "test.ts",
      `const foo = 1;`  // Only one occurrence
    );

    expect(() => findSymbolInLine(sourceFile, 1, "foo", 1)).toThrow(
      'Symbol "foo" only appears 1 time(s) on line 1, but index 1 was requested'
    );

    expect(() => findSymbolInLine(sourceFile, 1, "foo", -1)).toThrow(
      'Symbol "foo" only appears 1 time(s) on line 1, but index -1 was requested'
    );
  });

  it("should handle complex patterns with index", () => {
    const project = new Project();
    const sourceFile = project.createSourceFile(
      "test.ts",
      `import { useState, useEffect, useState as useStateAlias } from 'react';`
    );

    // Find first "useState"
    const result1 = findSymbolInLine(sourceFile, 1, "useState", 0);
    expect(result1.column).toBe(10);  // First occurrence

    // Find second "useState"
    const result2 = findSymbolInLine(sourceFile, 1, "useState", 1);
    expect(result2.column).toBe(31);  // Second occurrence
  });
});