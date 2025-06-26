import { type Project } from "ts-morph";
import { type Result, ok, err } from "neverthrow";
import { findNodeAndSymbolAtPosition, getIdentifierFromNode, extractLocationInfo, type LocationInfo } from "../utils/symbolNavigation.ts";

export interface FindReferencesRequest {
  filePath: string;
  line: number;
  column: number;
}

export type Reference = LocationInfo;

export interface FindReferencesSuccess {
  message: string;
  references: Reference[];
  symbol: {
    name: string;
    kind: string;
  };
}

export function findReferences(
  project: Project,
  request: FindReferencesRequest
): Result<FindReferencesSuccess, string> {
  // Find node and symbol at position
  const nodeResult = findNodeAndSymbolAtPosition(project, request);
  if (nodeResult.isErr()) {
    return err(nodeResult.error);
  }

  const { node, symbolInfo } = nodeResult.value;

  try {
    // Find references using ts-morph's findReferences
    const identifier = getIdentifierFromNode(node);
    if (!identifier) {
      return err(`No identifier found at position ${String(request.line)}:${String(request.column)}`);
    }

    const referencedSymbols = (identifier as any).findReferences();

    if (referencedSymbols.length === 0) {
      return ok({
        message: `No references found for symbol "${symbolInfo.name}"`,
        references: [],
        symbol: symbolInfo
      });
    }

    const references: Reference[] = [];

    for (const referencedSymbol of referencedSymbols) {
      for (const reference of referencedSymbol.getReferences()) {
        const refNode = reference.getNode();
        references.push(extractLocationInfo(refNode));
      }
    }

    return ok({
      message: `Found ${references.length} reference${references.length === 1 ? '' : 's'} for symbol "${symbolInfo.name}"`,
      references,
      symbol: symbolInfo
    });
  } catch (error) {
    return err(error instanceof Error ? error.message : String(error));
  }
}

if (import.meta.vitest) {
  const { test, describe, expect } = import.meta.vitest;
  const { Project } = await import("ts-morph");

  describe("findReferences", () => {
    test("finds references for a simple variable", () => {
      const project = new Project({
        useInMemoryFileSystem: true,
        compilerOptions: {
          target: 99,
          module: 99,
        },
      });

      const filePath = "/test/simple.ts";
      project.createSourceFile(
        filePath,
        `const myVariable = 42;
console.log(myVariable);
const result = myVariable + 10;
`
      );

      const result = findReferences(project, {
        filePath,
        line: 1,
        column: 7,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.references).toHaveLength(3);
        expect(result.value.symbol.name).toBe("myVariable");
        expect(result.value.references[0].line).toBe(1);
        expect(result.value.references[1].line).toBe(2);
        expect(result.value.references[2].line).toBe(3);
      }
    });

    test("finds references for a function", () => {
      const project = new Project({
        useInMemoryFileSystem: true,
        compilerOptions: {
          target: 99,
          module: 99,
        },
      });

      const filePath = "/test/function.ts";
      project.createSourceFile(
        filePath,
        `function greet(name: string) {
  return "Hello, " + name;
}

const message = greet("World");
console.log(greet("TypeScript"));
`
      );

      const result = findReferences(project, {
        filePath,
        line: 1,
        column: 10,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.references).toHaveLength(3);
        expect(result.value.symbol.name).toBe("greet");
        expect(result.value.references.some((ref) => ref.line === 5)).toBe(true);
        expect(result.value.references.some((ref) => ref.line === 6)).toBe(true);
      }
    });

    test("finds references across multiple files", () => {
      const project = new Project({
        useInMemoryFileSystem: true,
        compilerOptions: {
          target: 99,
          module: 99,
        },
      });

      const exportFilePath = "/test/export.ts";
      const importFilePath = "/test/import.ts";

      project.createSourceFile(
        exportFilePath,
        `export const sharedValue = 100;
export function sharedFunction() {
  return sharedValue;
}`
      );

      project.createSourceFile(
        importFilePath,
        `import { sharedValue, sharedFunction } from "./export.ts";

console.log(sharedValue);
const doubled = sharedValue * 2;
sharedFunction();`
      );

      const result = findReferences(project, {
        filePath: exportFilePath,
        line: 1,
        column: 14,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.references.length).toBeGreaterThan(2);
        expect(result.value.symbol.name).toBe("sharedValue");

        const filesPaths = [
          ...new Set(result.value.references.map((ref) => ref.filePath)),
        ];
        expect(filesPaths).toHaveLength(2);
      }
    });

    test("finds references for class members", () => {
      const project = new Project({
        useInMemoryFileSystem: true,
        compilerOptions: {
          target: 99,
          module: 99,
        },
      });

      const filePath = "/test/class.ts";
      project.createSourceFile(
        filePath,
        `class Calculator {
  private value: number = 0;
  
  add(n: number) {
    this.value += n;
    return this.value;
  }
  
  getValue() {
    return this.value;
  }
}

const calc = new Calculator();
calc.add(5);
console.log(calc.getValue());`
      );

      const result = findReferences(project, {
        filePath,
        line: 2,
        column: 11,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.symbol.name).toBe("value");
        expect(result.value.references.length).toBeGreaterThanOrEqual(3);

        const lines = result.value.references.map((ref) => ref.line);
        expect(lines).toContain(2);
        expect(lines).toContain(5);
        expect(lines).toContain(6);
        expect(lines).toContain(10);
      }
    });

    test("returns error for invalid position", () => {
      const project = new Project({
        useInMemoryFileSystem: true,
      });

      const filePath = "/test/empty.ts";
      project.createSourceFile(filePath, "");

      const result = findReferences(project, {
        filePath,
        line: 1,
        column: 1,
      });

      expect(result.isErr()).toBe(true);
    });

    test("returns error for non-existent file", () => {
      const project = new Project({
        useInMemoryFileSystem: true,
      });

      const result = findReferences(project, {
        filePath: "/test/nonexistent.ts",
        line: 1,
        column: 1,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("File not found");
      }
    });
  });
}