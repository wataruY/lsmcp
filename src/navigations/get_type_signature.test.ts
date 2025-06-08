import { describe, expect, it } from "vitest";
import { Project } from "ts-morph";
import { getTypeSignature } from "./get_type_signature.ts";

describe("getTypeSignature", () => {
  it("should get signature for ok function from neverthrow", () => {
    const project = new Project({
      compilerOptions: {
        moduleResolution: 100, // Bundler
        esModuleInterop: true,
        skipLibCheck: false,
      },
    });

    const result = getTypeSignature(project, {
      moduleName: "neverthrow",
      typeName: "ok",
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const { typeName, signature } = result.value;
      
      expect(typeName).toBe("ok");
      expect(signature.kind).toBe("function");
      expect(signature.functionSignatures).toBeDefined();
      expect(signature.functionSignatures!.length).toBeGreaterThan(0);
      
      // Check that signatures have the expected structure
      for (const sig of signature.functionSignatures!) {
        expect(sig.parameters).toBeDefined();
        expect(sig.returnType).toBeDefined();
        expect(sig.returnType).toContain("Ok");
        expect(sig.typeParameters).toBeDefined();
      }
    }
  });

  it("should handle non-existent function", () => {
    const project = new Project({
      compilerOptions: {
        moduleResolution: 100, // Bundler
      },
    });

    const result = getTypeSignature(project, {
      moduleName: "neverthrow",
      typeName: "nonExistentFunction",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toMatch(/not found|no declarations found/i);
    }
  });

  it("should get detailed parameter information", () => {
    const project = new Project({
      compilerOptions: {
        moduleResolution: 100, // Bundler
      },
    });

    // Create a test module with a function that has various parameter types
    const testModule = project.createSourceFile(
      "test-functions.ts",
      `
      export function testFunction<T extends string>(
        required: string,
        optional?: number,
        withDefault: boolean = true,
        ...rest: T[]
      ): { result: string; count: number } {
        return { result: required, count: rest.length };
      }
      
      export const arrowFunction = <T>(items: T[], predicate: (item: T) => boolean): T[] => {
        return items.filter(predicate);
      };
      `
    );

    const result = getTypeSignature(project, {
      moduleName: "./test-functions.ts",
      typeName: "testFunction",
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const { signature } = result.value;
      expect(signature.kind).toBe("function");
      expect(signature.functionSignatures).toBeDefined();
      expect(signature.functionSignatures!).toHaveLength(1);
      
      const sig = signature.functionSignatures![0];
      expect(sig.typeParameters).toBeDefined();
      expect(sig.typeParameters).toContainEqual("T extends string");
      
      // Check parameters
      expect(sig.parameters).toHaveLength(4);
      
      const [required, optional, withDefault, rest] = sig.parameters;
      
      expect(required.name).toBe("required");
      expect(required.type).toBe("string");
      expect(required.optional).toBe(false);
      
      expect(optional.name).toBe("optional");
      expect(optional.type).toBe("number");
      expect(optional.optional).toBe(true);
      
      expect(withDefault.name).toBe("withDefault");
      expect(withDefault.type).toBe("boolean");
      expect(withDefault.defaultValue).toBe("true");
      
      expect(rest.name).toBe("rest");
      expect(rest.type).toContain("T[]");
      
      // Check return type
      expect(sig.returnType).toBe("{ result: string; count: number; }");
    }

    // Test arrow function
    const arrowResult = getTypeSignature(project, {
      moduleName: "./test-functions.ts",
      typeName: "arrowFunction",
    });

    expect(arrowResult.isOk()).toBe(true);
    if (arrowResult.isOk()) {
      const { signature } = arrowResult.value;
      // Arrow functions are detected as functions, not variables
      expect(signature.kind).toBe("function");
      expect(signature.functionSignatures).toBeDefined();
      expect(signature.functionSignatures!).toHaveLength(1);
      
      const sig = signature.functionSignatures![0];
      expect(sig.typeParameters).toBeDefined();
      expect(sig.typeParameters).toContainEqual("T");
      expect(sig.returnType).toBe("T[]");
    }

    // Clean up
    testModule.delete();
  });

  it("should handle function overloads", () => {
    const project = new Project({
      compilerOptions: {
        moduleResolution: 100, // Bundler
      },
    });

    // Create a test module with overloaded functions
    const testModule = project.createSourceFile(
      "test-overloads.ts",
      `
      export function overloaded(x: string): string;
      export function overloaded(x: number): number;
      export function overloaded(x: boolean): boolean;
      export function overloaded(x: string | number | boolean): string | number | boolean {
        return x;
      }
      `
    );

    const result = getTypeSignature(project, {
      moduleName: "./test-overloads.ts",
      typeName: "overloaded",
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const { signature } = result.value;
      expect(signature.kind).toBe("function");
      expect(signature.functionSignatures).toBeDefined();
      
      // Should have 3 overload signatures (not the implementation)
      expect(signature.functionSignatures!.length).toBeGreaterThanOrEqual(3);
      
      // Check each overload
      const stringOverload = signature.functionSignatures!.find((s: any) => 
        s.parameters[0]?.type === "string" && s.returnType === "string"
      );
      expect(stringOverload).toBeDefined();
      
      const numberOverload = signature.functionSignatures!.find((s: any) => 
        s.parameters[0]?.type === "number" && s.returnType === "number"
      );
      expect(numberOverload).toBeDefined();
      
      const booleanOverload = signature.functionSignatures!.find((s: any) => 
        s.parameters[0]?.type === "boolean" && s.returnType === "boolean"
      );
      expect(booleanOverload).toBeDefined();
    }

    // Clean up
    testModule.delete();
  });

  it("should extract definitions including aliases", () => {
    const project = new Project({
      compilerOptions: {
        moduleResolution: 100, // Bundler
      },
    });

    // Create a test module with type aliases
    const testModule = project.createSourceFile(
      "test-aliases.ts",
      `
      export interface BaseUser {
        id: number;
        name: string;
      }
      
      export type User = BaseUser & {
        email: string;
      };
      
      export type AdminUser = User & {
        permissions: string[];
      };
      `
    );

    const result = getTypeSignature(project, {
      moduleName: "./test-aliases.ts",
      typeName: "AdminUser",
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const { signature } = result.value;
      expect(signature.kind).toBe("type");
      expect(signature.definitions).toBeDefined();
      expect(signature.definitions!.length).toBeGreaterThan(0);
      
      // Should have at least one definition
      const def = signature.definitions![0];
      expect(def.filePath).toContain("test-aliases.ts");
      expect(def.kind).toBe("Type alias");
      expect(def.line).toBeGreaterThan(0);
      expect(def.column).toBeGreaterThan(0);
      expect(def.name).toBe("AdminUser");
    }

    // Clean up
    testModule.delete();
  });

  it("should simplify type names", () => {
    const project = new Project({
      compilerOptions: {
        moduleResolution: 100, // Bundler
        esModuleInterop: true,
      },
    });

    const result = getTypeSignature(project, {
      moduleName: "neverthrow",
      typeName: "ok",
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const { signature } = result.value;
      expect(signature.kind).toBe("function");
      expect(signature.functionSignatures).toBeDefined();
      
      // Check that return types don't contain import paths
      for (const sig of signature.functionSignatures!) {
        expect(sig.returnType).not.toContain('import("');
        expect(sig.returnType).toContain("Ok<");
        
        // Check parameters don't contain import paths
        for (const param of sig.parameters) {
          expect(param.type).not.toContain('import("');
        }
      }
    }
  });
});