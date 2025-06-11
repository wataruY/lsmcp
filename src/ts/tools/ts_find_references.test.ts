import { describe, it, expect } from "vitest";
import { formatFindReferencesResult } from "./ts_find_references.ts";
import type { FindReferencesResult } from "./ts_find_references.ts";

describe("find_references", () => {
  describe("formatFindReferencesResult", () => {
    it("should format references with single result", () => {
      const result: FindReferencesResult = {
        message: "Found 1 reference to 'myFunction'",
        symbol: {
          name: "myFunction",
          kind: "function",
        },
        references: [
          {
            filePath: "/project/src/index.ts",
            line: 10,
            column: 5,
            lineText: "    myFunction();",
          },
        ],
      };

      expect(
        formatFindReferencesResult(result, "/project")
      ).toMatchInlineSnapshot(`
        "Found 1 reference to 'myFunction'
        Symbol: myFunction (function)

        References:
          src/index.ts:10:5 -     myFunction();"
      `);
    });

    it("should format references with multiple results", () => {
      const result: FindReferencesResult = {
        message: "Found 3 references to 'User'",
        symbol: {
          name: "User",
          kind: "class",
        },
        references: [
          {
            filePath: "/project/src/models/user.ts",
            line: 5,
            column: 14,
            lineText: "export class User {",
          },
          {
            filePath: "/project/src/services/auth.ts",
            line: 8,
            column: 22,
            lineText: "  constructor(user: User) {",
          },
          {
            filePath: "/project/src/api/users.ts",
            line: 15,
            column: 12,
            lineText: "  const user = new User();",
          },
        ],
      };

      expect(
        formatFindReferencesResult(result, "/project")
      ).toMatchInlineSnapshot(`
        "Found 3 references to 'User'
        Symbol: User (class)

        References:
          src/models/user.ts:5:14 - export class User {
          src/services/auth.ts:8:22 -   constructor(user: User) {
          src/api/users.ts:15:12 -   const user = new User();"
      `);
    });

    it("should format references with no results", () => {
      const result: FindReferencesResult = {
        message: "Found 0 references to 'unusedFunction'",
        symbol: {
          name: "unusedFunction",
          kind: "function",
        },
        references: [],
      };

      expect(
        formatFindReferencesResult(result, "/project")
      ).toMatchInlineSnapshot(`
        "Found 0 references to 'unusedFunction'
        Symbol: unusedFunction (function)

        References:"
      `);
    });

    it("should handle nested path resolution", () => {
      const result: FindReferencesResult = {
        message: "Found 2 references to 'config'",
        symbol: {
          name: "config",
          kind: "variable",
        },
        references: [
          {
            filePath: "/home/user/project/src/config/index.ts",
            line: 1,
            column: 14,
            lineText: "export const config = {",
          },
          {
            filePath: "/home/user/project/src/app.ts",
            line: 3,
            column: 10,
            lineText: "import { config } from './config';",
          },
        ],
      };

      expect(
        formatFindReferencesResult(result, "/home/user/project")
      ).toMatchInlineSnapshot(`
        "Found 2 references to 'config'
        Symbol: config (variable)

        References:
          src/config/index.ts:1:14 - export const config = {
          src/app.ts:3:10 - import { config } from './config';"
      `);
    });
  });
});