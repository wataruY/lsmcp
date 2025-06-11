import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import { goToDefinition } from "../navigations/go_to_definition";
import {
  findProjectForFile,
  getOrCreateSourceFileWithRefresh,
} from "../project_cache";
import { resolveLineParameter, findSymbolInLine } from "../../mcp/line_utils";
import type { ToolDef } from "../../mcp/types";

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

export interface GetDefinitionsResult {
  message: string;
  symbol: {
    name: string;
    kind: string;
  };
  definitions: {
    filePath: string;
    line: number;
    column: number;
    lineText: string;
  }[];
}

export async function handleGetDefinitions({
  root,
  filePath,
  line,
  symbolName,
}: z.infer<typeof schema>): Promise<GetDefinitionsResult> {
  // Always treat paths as relative to root
  const absolutePath = path.join(root, filePath);

  // Check if file exists
  await fs.access(absolutePath);

  const project = findProjectForFile(absolutePath);

  // Get the source file to find the column position with fresh content
  const sourceFile = getOrCreateSourceFileWithRefresh(absolutePath);

  // Resolve line parameter
  const resolvedLine = resolveLineParameter(sourceFile, line);

  // Find the symbol in the line and get column position
  const { column } = findSymbolInLine(sourceFile, resolvedLine, symbolName);

  // Find definition using the column position
  const result = goToDefinition(project, {
    filePath: absolutePath,
    line: resolvedLine,
    column,
  });

  if (result.isErr()) {
    throw new Error(result.error);
  }

  return result.value;
}

export function formatGetDefinitionsResult(
  result: GetDefinitionsResult,
  root: string,
  options?: { before?: number; after?: number }
): string {
  const { message, definitions, symbol } = result;

  // Format the output
  const output = [
    message,
    `Symbol: ${symbol.name} (${symbol.kind})`,
    "",
    "Definitions:",
  ];

  for (const def of definitions) {
    const relativePath = path.relative(root, def.filePath);
    output.push(
      `  ${relativePath}:${def.line}:${def.column} - ${def.lineText}`
    );

    // Add context lines if requested
    if (options?.before || options?.after) {
      const defSourceFile = getOrCreateSourceFileWithRefresh(def.filePath);
      if (defSourceFile) {
        const fullText = defSourceFile.getFullText();
        const lines = fullText.split("\n");

        const startLine = Math.max(0, def.line - 1 - (options.before || 0));
        const endLine = Math.min(lines.length, def.line + (options.after || 0));

        if (options.before && startLine < def.line - 1) {
          output.push("");
          for (let i = startLine; i < def.line - 1; i++) {
            output.push(`    ${i + 1}: ${lines[i]}`);
          }
        }

        // Show the definition line with arrow
        output.push(`  → ${def.line}: ${lines[def.line - 1]}`);

        if (options.after && def.line < endLine) {
          for (let i = def.line; i < endLine; i++) {
            output.push(`    ${i + 1}: ${lines[i]}`);
          }
        }
      }
    }
  }

  return output.join("\n");
}

export const getDefinitionsTool: ToolDef<typeof schema> = {
  name: "get_definitions",
  description: "Get the definition(s) of a TypeScript symbol",
  schema,
  execute: async ({ root, filePath, line, symbolName, before, after }) => {
    const result = await handleGetDefinitions({
      root,
      filePath,
      line,
      symbolName,
    });
    return Promise.resolve(
      formatGetDefinitionsResult(result, root, { before, after })
    );
  },
};
