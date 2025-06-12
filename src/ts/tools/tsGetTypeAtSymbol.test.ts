import { describe, it, expect } from "vitest";
import { formatGetTypeAtSymbolResult } from "./tsGetTypeAtSymbol.ts";
import type { GetTypeAtSymbolResult } from "./tsGetTypeAtSymbol.ts";

describe("get_type_at_symbol", () => {
  describe("formatGetTypeAtSymbolResult", () => {
    it("should format type information for a variable", () => {
      const result: GetTypeAtSymbolResult = {
        symbol: {
          name: "count",
          kind: "variable",
        },
        type: "number",
        location: {
          filePath: "/project/src/utils.ts",
          line: 10,
          column: 7,
        },
      };

      expect(formatGetTypeAtSymbolResult(result, "/project")).toMatchInlineSnapshot(`
        "Type information for "count" (variable)
        Location: src/utils.ts:10:7

        Type: number"
      `);
    });

    it("should format type information for a function", () => {
      const result: GetTypeAtSymbolResult = {
        symbol: {
          name: "calculateSum",
          kind: "function",
        },
        type: "(a: number, b: number) => number",
        location: {
          filePath: "/project/src/math.ts",
          line: 5,
          column: 17,
        },
      };

      expect(formatGetTypeAtSymbolResult(result, "/project")).toMatchInlineSnapshot(`
        "Type information for "calculateSum" (function)
        Location: src/math.ts:5:17

        Type: (a: number, b: number) => number"
      `);
    });

    it("should format type information with documentation", () => {
      const result: GetTypeAtSymbolResult = {
        symbol: {
          name: "User",
          kind: "interface",
        },
        type: "User",
        documentation: "@description Represents a user in the system\n@since 1.0.0",
        location: {
          filePath: "/project/src/types/user.ts",
          line: 3,
          column: 18,
        },
      };

      expect(formatGetTypeAtSymbolResult(result, "/project")).toMatchInlineSnapshot(`
        "Type information for "User" (interface)
        Location: src/types/user.ts:3:18

        Type: User

        Documentation:
        @description Represents a user in the system
        @since 1.0.0"
      `);
    });

    it("should format type information for a complex type", () => {
      const result: GetTypeAtSymbolResult = {
        symbol: {
          name: "config",
          kind: "variable",
        },
        type: "{ apiUrl: string; timeout: number; retries: number; }",
        location: {
          filePath: "/project/src/config.ts",
          line: 15,
          column: 7,
        },
      };

      expect(formatGetTypeAtSymbolResult(result, "/project")).toMatchInlineSnapshot(`
        "Type information for "config" (variable)
        Location: src/config.ts:15:7

        Type: { apiUrl: string; timeout: number; retries: number; }"
      `);
    });

    it("should format type information for a method", () => {
      const result: GetTypeAtSymbolResult = {
        symbol: {
          name: "getName",
          kind: "method",
        },
        type: "() => string",
        location: {
          filePath: "/project/src/models/Person.ts",
          line: 20,
          column: 3,
        },
      };

      expect(formatGetTypeAtSymbolResult(result, "/project")).toMatchInlineSnapshot(`
        "Type information for "getName" (method)
        Location: src/models/Person.ts:20:3

        Type: () => string"
      `);
    });

    it("should format type information for a type alias", () => {
      const result: GetTypeAtSymbolResult = {
        symbol: {
          name: "UserID",
          kind: "type alias",
        },
        type: "string",
        location: {
          filePath: "/project/src/types/index.ts",
          line: 1,
          column: 13,
        },
      };

      expect(formatGetTypeAtSymbolResult(result, "/project")).toMatchInlineSnapshot(`
        "Type information for "UserID" (type alias)
        Location: src/types/index.ts:1:13

        Type: string"
      `);
    });
  });
});