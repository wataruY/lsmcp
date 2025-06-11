import { z } from "zod";
import { type Result, ok, err } from "neverthrow";
import { readFileSync } from "fs";
import { relative } from "path";
import { setupLSPRequest } from "../../ts/tools/lsp_common.ts";
import type { ToolDef } from "../../mcp/types.ts";

const schema = z.object({
  root: z.string().describe("Root directory for resolving relative paths"),
  filePath: z
    .string()
    .describe("File path containing the symbol (relative to root)"),
  line: z
    .union([z.number(), z.string()])
    .describe("Line number (1-based) or string to match in the line"),
  symbolName: z.string().describe("Name of the symbol to get definitions for"),
  before: z
    .number()
    .optional()
    .describe("Number of lines to show before the definition"),
  after: z
    .number()
    .optional()
    .describe("Number of lines to show after the definition"),
});

type GetDefinitionsRequest = z.infer<typeof schema>;

interface Definition {
  filePath: string;
  line: number;
  column: number;
  symbolName: string;
  preview: string;
}

interface GetDefinitionsSuccess {
  message: string;
  definitions: Definition[];
}

// LSP definition/location types
interface Location {
  uri: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

type DefinitionResult = Location | Location[] | null;

/**
 * Gets definitions for a TypeScript symbol using LSP
 */
async function getDefinitionsWithLSP(
  request: GetDefinitionsRequest
): Promise<Result<GetDefinitionsSuccess, string>> {
  const setupResult = await setupLSPRequest(request);
  if ("error" in setupResult) {
    return err(setupResult.error);
  }

  const { setup } = setupResult;
  const { client, fileUri, targetLine, symbolPosition } = setup;

  try {
    // Get definition
    const result = (await client.getDefinition(fileUri, {
      line: targetLine,
      character: symbolPosition,
    })) as DefinitionResult;

    // Normalize result to array
    const locations = result ? (Array.isArray(result) ? result : [result]) : [];

    // Convert LSP locations to our Definition format
    const definitions: Definition[] = [];
    const contextBefore = request.before || 2;
    const contextAfter = request.after || 2;

    for (const location of locations) {
      const defPath = location.uri.replace("file://", "");
      const defContent = readFileSync(defPath, "utf-8");
      const defLines = defContent.split("\n");

      // Get the text at the definition location
      const startLine = location.range.start.line;
      const startCol = location.range.start.character;
      const defLineText = defLines[startLine] || "";

      // Try to extract the symbol text from the line
      let symbolName = "";

      // Simple heuristic to find identifier boundaries
      const identifierPattern = /[a-zA-Z_$][a-zA-Z0-9_$]*/g;
      let match;
      while ((match = identifierPattern.exec(defLineText)) !== null) {
        if (
          match.index <= startCol &&
          startCol < match.index + match[0].length
        ) {
          symbolName = match[0];
          break;
        }
      }

      // If no symbol found, use the requested symbol name
      if (!symbolName) {
        symbolName = request.symbolName;
      }

      // Create preview with context
      const previewLines: string[] = [];
      for (
        let i = Math.max(0, startLine - contextBefore);
        i <= Math.min(defLines.length - 1, startLine + contextAfter);
        i++
      ) {
        previewLines.push(`${i + 1}: ${defLines[i]}`);
      }
      const preview = previewLines.join("\n");

      definitions.push({
        filePath: relative(request.root, defPath),
        line: startLine + 1, // Convert to 1-based
        column: startCol + 1, // Convert to 1-based
        symbolName,
        preview,
      });
    }

    await client.stop();

    return ok({
      message: `Found ${definitions.length} definition${
        definitions.length === 1 ? "" : "s"
      } for "${request.symbolName}"`,
      definitions,
    });
  } catch (error) {
    await client.stop().catch(() => {});
    return err(error instanceof Error ? error.message : String(error));
  }
}

export const lspGetDefinitionsTool: ToolDef<typeof schema> = {
  name: "lsp_get_definitions",
  description: "Get the definition(s) of a TypeScript symbol using LSP",
  schema,
  handler: async (args) => {
    const result = await getDefinitionsWithLSP(args);
    if (result.isOk()) {
      const messages = [result.value.message];

      if (result.value.definitions.length > 0) {
        for (const def of result.value.definitions) {
          messages.push(
            `\n${def.filePath}:${def.line}:${def.column} - ${def.symbolName}\n${def.preview}`
          );
        }
      }

      return messages.join("\n\n");
    } else {
      throw new Error(result.error);
    }
  },
};
