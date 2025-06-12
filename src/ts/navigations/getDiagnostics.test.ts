import { Project } from "ts-morph";
import { describe, it, expect } from "vitest";
import { getDiagnostics } from "./getDiagnostics.ts";

describe("getDiagnostics", () => {
  it("should find type errors", () => {
    const project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        target: 99, // ESNext
        strict: true,
      },
    });

    project.createSourceFile(
      "/src/main.ts",
      `const x: string = 123; // Type error
function greet(name: string) {
  return "Hello, " + name;
}
greet(456); // Type error`
    );

    const result = getDiagnostics(project, {
      filePaths: ["/src/main.ts"],
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const { diagnostics, message } = result.value;
      expect(diagnostics).toHaveLength(2);
      
      // Check that message contains formatted diagnostics
      expect(message).toContain("main.ts");
      expect(message).toContain("Type 'number' is not assignable to type 'string'");
      
      // First error: string = 123
      expect(diagnostics[0].line).toBe(1);
      expect(diagnostics[0].category).toBe("error");
      expect(diagnostics[0].message).toContain("Type 'number' is not assignable to type 'string'");
      
      // Second error: greet(456)
      expect(diagnostics[1].line).toBe(5);
      expect(diagnostics[1].category).toBe("error");
      expect(diagnostics[1].message).toContain("Argument of type 'number' is not assignable to parameter of type 'string'");
    }
  });

  it("should find unused variable warnings", () => {
    const project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        target: 99, // ESNext
        noUnusedLocals: true,
      },
    });

    project.createSourceFile(
      "/src/utils.ts",
      `const unusedVar = 42;
export function useThis() {
  return "used";
}`
    );

    const result = getDiagnostics(project, {
      filePaths: ["/src/utils.ts"],
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const { diagnostics } = result.value;
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].message).toContain("'unusedVar' is declared but its value is never read");
    }
  });

  it("should handle files with no diagnostics", () => {
    const project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        target: 99, // ESNext
      },
    });

    project.createSourceFile(
      "/src/clean.ts",
      `export function add(a: number, b: number): number {
  return a + b;
}

console.log(add(1, 2));`
    );

    const result = getDiagnostics(project, {
      filePaths: ["/src/clean.ts"],
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const { diagnostics, message } = result.value;
      expect(diagnostics).toHaveLength(0);
      expect(message).toBe("No diagnostics found in 1 file.");
    }
  });

  it("should find missing imports", () => {
    const project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        target: 99, // ESNext
        moduleResolution: 2, // NodeJs
      },
    });

    project.createSourceFile(
      "/src/missing-import.ts",
      `import { nonExistent } from "./does-not-exist.ts";

console.log(nonExistent);`
    );

    const result = getDiagnostics(project, {
      filePaths: ["/src/missing-import.ts"],
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const { diagnostics } = result.value;
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].category).toBe("error");
    }
  });

  it("should return error for non-existent file", () => {
    const project = new Project({
      useInMemoryFileSystem: true,
    });

    const result = getDiagnostics(project, {
      filePaths: ["/src/nonexistent.ts"],
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toContain("No valid source files found");
    }
  });

  it("should handle syntax errors", () => {
    const project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        target: 99, // ESNext
      },
    });

    project.createSourceFile(
      "/src/syntax-error.ts",
      `function broken( {
  return "missing closing paren";
}`
    );

    const result = getDiagnostics(project, {
      filePaths: ["/src/syntax-error.ts"],
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const { diagnostics } = result.value;
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].category).toBe("error");
      // TypeScript reports this as a missing implementation error
      expect(diagnostics[0].message.toLowerCase()).toContain("function implementation");
    }
  });
});