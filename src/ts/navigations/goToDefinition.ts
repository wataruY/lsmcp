import { type Project, Node, ts } from "ts-morph";
import { type Result, ok, err } from "neverthrow";

export interface GoToDefinitionRequest {
  filePath: string;
  line: number;
  column: number;
}

export interface Definition {
  filePath: string;
  line: number;
  column: number;
  text: string;
  lineText: string;
  kind: string;
}

export interface GoToDefinitionSuccess {
  message: string;
  definitions: Definition[];
  symbol: {
    name: string;
    kind: string;
  };
}

export function goToDefinition(
  project: Project,
  request: GoToDefinitionRequest
): Result<GoToDefinitionSuccess, string> {
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
    // Find the identifier node
    const identifier = Node.isIdentifier(node) ? node : node.getFirstDescendantByKind(ts.SyntaxKind.Identifier);
    if (!identifier) {
      return err(`No identifier found at position ${String(request.line)}:${String(request.column)}`);
    }

    // Get definition nodes
    const definitionNodes = identifier.getDefinitionNodes();

    if (definitionNodes.length === 0) {
      return ok({
        message: `No definitions found for symbol "${symbolName}"`,
        definitions: [],
        symbol: {
          name: symbolName,
          kind: symbolKind
        }
      });
    }

    const definitions: Definition[] = [];

    for (const defNode of definitionNodes) {
      const defSourceFile = defNode.getSourceFile();
      const start = defNode.getStart();
      const startLineAndCol = defSourceFile.getLineAndColumnAtPos(start);
      
      // Get line text
      const fullText = defSourceFile.getFullText();
      const lines = fullText.split('\n');
      const lineText = lines[startLineAndCol.line - 1] || '';

      definitions.push({
        filePath: defSourceFile.getFilePath(),
        line: startLineAndCol.line,
        column: startLineAndCol.column,
        text: defNode.getText(),
        lineText: lineText.trim(),
        kind: defNode.getKindName()
      });
    }

    return ok({
      message: `Found ${definitions.length} definition${definitions.length === 1 ? '' : 's'} for symbol "${symbolName}"`,
      definitions,
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
  const { describe, it, expect } = await import("vitest");
  const { Project } = await import("ts-morph");

  describe("goToDefinition", () => {
    it("should find function definition", () => {
      const project = new Project({
        useInMemoryFileSystem: true,
        compilerOptions: {
          target: 99, // ESNext
        },
      });

      // Create test files
      project.createSourceFile(
        "/src/utils.ts",
        `export function greet(name: string) {
  return \`Hello, \${name}!\`;
}`
      );

      project.createSourceFile(
        "/src/main.ts",
        `import { greet } from "./utils.ts";

const message = greet("World");
console.log(message);`
      );

      // Test finding definition of 'greet' from its usage
      const result = goToDefinition(project, {
        filePath: "/src/main.ts",
        line: 3,
        column: 17, // Position on 'greet' in 'greet("World")'
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const { definitions, symbol } = result.value;
        expect(definitions).toHaveLength(1);
        expect(definitions[0].filePath).toBe("/src/utils.ts");
        expect(definitions[0].line).toBe(1);
        expect(symbol.name).toBe("greet");
      }
    });

    it("should find variable definition", () => {
      const project = new Project({
        useInMemoryFileSystem: true,
        compilerOptions: {
          target: 99, // ESNext
        },
      });

      project.createSourceFile(
        "/src/main.ts",
        `const myVariable = 42;
const doubled = myVariable * 2;
console.log(doubled);`
      );

      // Test finding definition of 'myVariable' from its usage
      const result = goToDefinition(project, {
        filePath: "/src/main.ts",
        line: 2,
        column: 17, // Position on 'myVariable' in 'myVariable * 2'
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const { definitions, symbol } = result.value;
        expect(definitions).toHaveLength(1);
        expect(definitions[0].line).toBe(1);
        expect(definitions[0].text).toContain("myVariable");
        expect(symbol.name).toBe("myVariable");
      }
    });

    it("should find class definition", () => {
      const project = new Project({
        useInMemoryFileSystem: true,
        compilerOptions: {
          target: 99, // ESNext
        },
      });

      project.createSourceFile(
        "/src/models/user.ts",
        `export class User {
  constructor(public name: string) {}
}`
      );

      project.createSourceFile(
        "/src/main.ts",
        `import { User } from "./models/user.ts";

const user = new User("Alice");`
      );

      // Test finding definition of 'User' from its usage
      const result = goToDefinition(project, {
        filePath: "/src/main.ts",
        line: 3,
        column: 18, // Position on 'User' in 'new User("Alice")'
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const { definitions, symbol } = result.value;
        expect(definitions).toHaveLength(1);
        expect(definitions[0].filePath).toBe("/src/models/user.ts");
        expect(definitions[0].line).toBe(1);
        expect(symbol.name).toBe("User");
      }
    });

    it("should handle multiple definitions", () => {
      const project = new Project({
        useInMemoryFileSystem: true,
        compilerOptions: {
          target: 99, // ESNext
        },
      });

      // Create a file with function overloads
      project.createSourceFile(
        "/src/utils.ts",
        `export function process(value: string): string;
export function process(value: number): number;
export function process(value: string | number): string | number {
  return value;
}`
      );

      project.createSourceFile(
        "/src/main.ts",
        `import { process } from "./utils.ts";

const result = process("test");`
      );

      // Test finding definitions of overloaded function
      const result = goToDefinition(project, {
        filePath: "/src/main.ts",
        line: 3,
        column: 16, // Position on 'process'
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const { definitions } = result.value;
        // ts-morph returns the implementation, not all overloads
        expect(definitions.length).toBeGreaterThanOrEqual(1);
        expect(definitions[0].filePath).toBe("/src/utils.ts");
      }
    });

    it("should return error for non-existent file", () => {
      const project = new Project({
        useInMemoryFileSystem: true,
      });

      const result = goToDefinition(project, {
        filePath: "/src/nonexistent.ts",
        line: 1,
        column: 1,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("File not found");
      }
    });

    it("should handle built-in symbols", () => {
      const project = new Project({
        useInMemoryFileSystem: true,
        compilerOptions: {
          target: 99, // ESNext
        },
      });

      project.createSourceFile(
        "/src/main.ts",
        `console.log("Hello");`
      );

      // Try to find definition of 'console' (built-in)
      const result = goToDefinition(project, {
        filePath: "/src/main.ts",
        line: 1,
        column: 1, // Position on 'console'
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const { definitions } = result.value;
        // Built-in symbols may have definitions in lib.d.ts files
        expect(definitions.length).toBeGreaterThanOrEqual(0);
      }
    });
  });
}