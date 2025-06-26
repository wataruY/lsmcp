import { z } from "zod";
import { findReferences } from "../navigations/findReferences.ts";
import { prepareToolContext, formatRelativePath } from "../utils/toolHandlers.ts";
import type { ToolDef } from "../../mcp/_mcplib.ts";
import { symbolLocationSchema } from "../../common/schemas.ts";

const schema = symbolLocationSchema;

interface FindReferencesResult {
  message: string;
  symbol: {
    name: string;
    kind: string;
  };
  references: {
    filePath: string;
    line: number;
    column: number;
    lineText: string;
  }[];
}

async function handleFindReferences(
  params: z.infer<typeof schema>
): Promise<FindReferencesResult> {
  const context = await prepareToolContext(params);

  // Find references
  const result = findReferences(context.project, {
    filePath: context.absolutePath,
    line: context.resolvedLine,
    column: context.column,
  });

  if (result.isErr()) {
    throw new Error(result.error);
  }

  return result.value;
}

function formatFindReferencesResult(
  result: FindReferencesResult,
  root: string
): string {
  const { message, references, symbol } = result;

  // Format the output
  const output = [
    message,
    `Symbol: ${symbol.name} (${symbol.kind})`,
    "",
    "References:",
  ];

  for (const ref of references) {
    const relativePath = formatRelativePath(ref.filePath, root);
    output.push(
      `  ${relativePath}:${ref.line}:${ref.column} - ${ref.lineText}`
    );
  }

  return output.join("\n");
}

export const findReferencesTool: ToolDef<typeof schema> = {
  name: "find_references",
  description:
    "Find all references to a TypeScript/JavaScript symbol across the codebase",
  schema,
  execute: async (args) => {
    const result = await handleFindReferences(args);
    return formatFindReferencesResult(result, args.root);
  },
};

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

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
}
