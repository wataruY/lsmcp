import { type Project, Node, ts } from "ts-morph";
import { type Result, ok, err } from "neverthrow";

export interface FindReferencesRequest {
  filePath: string;
  line: number;
  column: number;
}

export interface Reference {
  filePath: string;
  line: number;
  column: number;
  text: string;
  lineText: string;
}

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
  const sourceFile = project.getSourceFile(request.filePath);
  if (!sourceFile) {
    return err(`File not found: ${request.filePath}`);
  }

  // Find the position
  const position = sourceFile.compilerNode.getPositionOfLineAndCharacter(
    request.line - 1,
    request.column - 1
  );

  const node = sourceFile.getDescendantAtPos(position);
  if (!node) {
    return err(`No node found at position ${String(request.line)}:${String(request.column)}`);
  }

  const symbol = node.getSymbol();
  if (!symbol) {
    return err(`No symbol found at position ${String(request.line)}:${String(request.column)}`);
  }

  const symbolName = symbol.getName();
  const symbolKind = node.getKindName();

  try {
    // Find references using ts-morph's findReferences
    // We need to use a Node method, not directly on node
    const identifier = Node.isIdentifier(node) ? node : node.getFirstDescendantByKind(ts.SyntaxKind.Identifier);
    if (!identifier) {
      return err(`No identifier found at position ${String(request.line)}:${String(request.column)}`);
    }

    const referencedSymbols = identifier.findReferences();

    if (referencedSymbols.length === 0) {
      return ok({
        message: `No references found for symbol "${symbolName}"`,
        references: [],
        symbol: {
          name: symbolName,
          kind: symbolKind
        }
      });
    }

    const references: Reference[] = [];

    for (const referencedSymbol of referencedSymbols) {
      for (const reference of referencedSymbol.getReferences()) {
        const refSourceFile = reference.getSourceFile();
        const refNode = reference.getNode();
        const start = refNode.getStart();
        const startLineAndCol = refSourceFile.getLineAndColumnAtPos(start);
        
        // Get line text
        const fullText = refSourceFile.getFullText();
        const lines = fullText.split('\n');
        const lineText = lines[startLineAndCol.line - 1] || '';

        references.push({
          filePath: refSourceFile.getFilePath(),
          line: startLineAndCol.line,
          column: startLineAndCol.column,
          text: refNode.getText(),
          lineText: lineText.trim()
        });
      }
    }

    return ok({
      message: `Found ${references.length} reference${references.length === 1 ? '' : 's'} for symbol "${symbolName}"`,
      references,
      symbol: {
        name: symbolName,
        kind: symbolKind
      }
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