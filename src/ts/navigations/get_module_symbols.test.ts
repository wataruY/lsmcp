import { describe, expect, it } from "vitest";
import { Project } from "ts-morph";
import { getModuleSymbols } from "./get_module_symbols.ts";

describe("getModuleSymbols", () => {
  it("should get symbols from neverthrow module", () => {
    const project = new Project({
      compilerOptions: {
        moduleResolution: 100, // Bundler
        esModuleInterop: true,
        skipLibCheck: false,
      },
    });

    const result = getModuleSymbols(project, {
      moduleName: "neverthrow",
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const { symbols, totalSymbols } = result.value;
      
      // Check that we found symbols
      expect(totalSymbols).toBeGreaterThan(0);
      
      // Check specific symbols we know should exist
      const resultType = symbols.types.find((t) => t.name === "Result");
      expect(resultType).toBeDefined();
      
      const okClass = symbols.classes.find((c) => c.name === "Ok");
      expect(okClass).toBeDefined();
      
      const errClass = symbols.classes.find((c) => c.name === "Err");
      expect(errClass).toBeDefined();
      
      const okFunction = symbols.functions.find((f) => f.name === "ok");
      expect(okFunction).toBeDefined();
      
      const errFunction = symbols.functions.find((f) => f.name === "err");
      expect(errFunction).toBeDefined();
    }
  });

  it("should handle non-existent module", () => {
    const project = new Project();

    const result = getModuleSymbols(project, {
      moduleName: "non-existent-module-xyz",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toContain("Module not found");
    }
  });

  it("should categorize different symbol types correctly", () => {
    const project = new Project({
      compilerOptions: {
        moduleResolution: 100, // Bundler
      },
    });

    // Create a test module
    const testModule = project.createSourceFile(
      "test-module.ts",
      `
      export type MyType<T> = T | null;
      export interface MyInterface {
        prop: string;
        method(): void;
      }
      export class MyClass {
        constructor(public value: string) {}
        getValue(): string { return this.value; }
      }
      export function myFunction(x: number): string {
        return x.toString();
      }
      export const myVariable = 42;
      export const myObject = { key: "value" };
      export const myArrowFunction = (x: number) => x * 2;
      `
    );

    // Create a file that imports from the test module
    const importFile = project.createSourceFile(
      "import-test.ts",
      `import * as testExports from "./test-module.ts";`
    );

    const result = getModuleSymbols(project, {
      moduleName: "./test-module.ts",
      filePath: "import-test.ts",
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const { symbols } = result.value;
      
      // Check type
      expect(symbols.types).toHaveLength(1);
      expect(symbols.types[0].name).toBe("MyType");
      expect(symbols.types[0].kind).toBe("type");
      
      // Check interface
      expect(symbols.interfaces).toHaveLength(1);
      expect(symbols.interfaces[0].name).toBe("MyInterface");
      expect(symbols.interfaces[0].kind).toBe("interface");
      
      // Check class
      expect(symbols.classes).toHaveLength(1);
      expect(symbols.classes[0].name).toBe("MyClass");
      expect(symbols.classes[0].kind).toBe("class");
      
      // Check functions
      expect(symbols.functions.map(f => f.name)).toContain("myFunction");
      expect(symbols.functions.map(f => f.name)).toContain("myArrowFunction");
      
      // Check variables
      expect(symbols.variables.map(v => v.name)).toContain("myVariable");
      expect(symbols.variables.map(v => v.name)).toContain("myObject");
    }

    // Clean up
    testModule.delete();
    importFile.delete();
  });
});