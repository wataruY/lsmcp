import { describe, it, expect } from "vitest";
import { formatGetModuleSymbolsResult } from "./tsGetModuleSymbols.ts";
import type { GetModuleSymbolsResult } from "./tsGetModuleSymbols.ts";

describe("get_module_symbols", () => {
  describe("formatGetModuleSymbolsResult", () => {
    it("should format module with all symbol types", () => {
      const result: GetModuleSymbolsResult = {
        message: "Found 10 exported symbols in module 'my-utils'",
        symbols: {
          types: [
            { name: "UserID", kind: "TypeAlias" },
            { name: "Config", kind: "TypeAlias" },
          ],
          interfaces: [
            { name: "IUser", kind: "Interface" },
            { name: "IProduct", kind: "Interface" },
          ],
          classes: [
            { name: "UserService", kind: "Class" },
            { name: "ProductService", kind: "Class" },
          ],
          functions: [
            { name: "createUser", kind: "Function" },
            { name: "deleteUser", kind: "Function" },
          ],
          variables: [
            { name: "DEFAULT_CONFIG", kind: "Variable" },
            { name: "API_URL", kind: "Variable" },
          ],
          others: [],
        },
      };

      expect(formatGetModuleSymbolsResult(result)).toMatchInlineSnapshot(`
        "Found 10 exported symbols in module 'my-utils'

        📋 Types: UserID, Config
        📐 Interfaces: IUser, IProduct
        🏗️ Classes: UserService, ProductService
        ⚡ Functions: createUser, deleteUser
        📦 Variables: DEFAULT_CONFIG, API_URL"
      `);
    });

    it("should format module with only some symbol types", () => {
      const result: GetModuleSymbolsResult = {
        message: "Found 3 exported symbols in module 'react'",
        symbols: {
          types: [{ name: "FC", kind: "TypeAlias" }],
          interfaces: [],
          classes: [],
          functions: [
            { name: "useState", kind: "Function" },
            { name: "useEffect", kind: "Function" },
          ],
          variables: [],
          others: [],
        },
      };

      expect(formatGetModuleSymbolsResult(result)).toMatchInlineSnapshot(`
        "Found 3 exported symbols in module 'react'

        📋 Types: FC
        ⚡ Functions: useState, useEffect"
      `);
    });

    it("should format module with no symbols", () => {
      const result: GetModuleSymbolsResult = {
        message: "No exported symbols found in module 'empty-module'",
        symbols: {
          types: [],
          interfaces: [],
          classes: [],
          functions: [],
          variables: [],
          others: [],
        },
      };

      expect(formatGetModuleSymbolsResult(result)).toMatchInlineSnapshot(`
        "No exported symbols found in module 'empty-module'
        "
      `);
    });

    it("should format module with other symbol types", () => {
      const result: GetModuleSymbolsResult = {
        message: "Found 2 exported symbols in module 'special'",
        symbols: {
          types: [],
          interfaces: [],
          classes: [],
          functions: [],
          variables: [],
          others: [
            { name: "namespace", kind: "Namespace" },
            { name: "enum", kind: "Enum" },
          ],
        },
      };

      expect(formatGetModuleSymbolsResult(result)).toMatchInlineSnapshot(`
        "Found 2 exported symbols in module 'special'

        ❓ Others: namespace, enum"
      `);
    });

    it("should handle long symbol lists", () => {
      const result: GetModuleSymbolsResult = {
        message: "Found many exported symbols in module 'large-lib'",
        symbols: {
          types: [],
          interfaces: [],
          classes: [],
          functions: Array.from({ length: 10 }, (_, i) => ({
            name: `func${i}`,
            kind: "Function",
          })),
          variables: [],
          others: [],
        },
      };

      expect(formatGetModuleSymbolsResult(result)).toMatchInlineSnapshot(`
        "Found many exported symbols in module 'large-lib'

        ⚡ Functions: func0, func1, func2, func3, func4, func5, func6, func7, func8, func9"
      `);
    });
  });
});