import { describe, it, expect } from "vitest";
import { formatGetDefinitionsResult } from "./tsGetDefinitions.ts";
import type { GetDefinitionsResult } from "./tsGetDefinitions.ts";

describe("get_definitions", () => {
  describe("formatGetDefinitionsResult", () => {
    it("should format single definition", async () => {
      const result: GetDefinitionsResult = {
        message: "Found 1 definition for 'MyComponent'",
        symbol: {
          name: "MyComponent",
          kind: "function",
        },
        definitions: [
          {
            filePath: "/project/src/components/MyComponent.tsx",
            line: 5,
            column: 17,
            lineText: "export function MyComponent() {",
          },
        ],
      };

      const formatted = await formatGetDefinitionsResult(result, "/project");
      expect(formatted).toMatchInlineSnapshot(`
        "Found 1 definition for 'MyComponent'
        Symbol: MyComponent (function)

        Definitions:
          src/components/MyComponent.tsx:5:17 - export function MyComponent() {"
      `);
    });

    it("should format multiple definitions", async () => {
      const result: GetDefinitionsResult = {
        message: "Found 2 definitions for 'User'",
        symbol: {
          name: "User",
          kind: "interface",
        },
        definitions: [
          {
            filePath: "/project/src/types/user.ts",
            line: 3,
            column: 18,
            lineText: "export interface User {",
          },
          {
            filePath: "/project/src/models/user.ts",
            line: 10,
            column: 14,
            lineText: "export class User implements IUser {",
          },
        ],
      };

      const formatted = await formatGetDefinitionsResult(result, "/project");
      expect(formatted).toMatchInlineSnapshot(`
        "Found 2 definitions for 'User'
        Symbol: User (interface)

        Definitions:
          src/types/user.ts:3:18 - export interface User {
          src/models/user.ts:10:14 - export class User implements IUser {"
      `);
    });

    it("should format with no definitions", async () => {
      const result: GetDefinitionsResult = {
        message: "No definition found for 'unknownSymbol'",
        symbol: {
          name: "unknownSymbol",
          kind: "unknown",
        },
        definitions: [],
      };

      const formatted = await formatGetDefinitionsResult(result, "/project");
      expect(formatted).toMatchInlineSnapshot(`
        "No definition found for 'unknownSymbol'
        Symbol: unknownSymbol (unknown)

        Definitions:"
      `);
    });

    it("should handle type alias definitions", async () => {
      const result: GetDefinitionsResult = {
        message: "Found 1 definition for 'UserID'",
        symbol: {
          name: "UserID",
          kind: "type alias",
        },
        definitions: [
          {
            filePath: "/project/src/types/index.ts",
            line: 7,
            column: 13,
            lineText: "export type UserID = string;",
          },
        ],
      };

      const formatted = await formatGetDefinitionsResult(result, "/project");
      expect(formatted).toMatchInlineSnapshot(`
        "Found 1 definition for 'UserID'
        Symbol: UserID (type alias)

        Definitions:
          src/types/index.ts:7:13 - export type UserID = string;"
      `);
    });
  });
});