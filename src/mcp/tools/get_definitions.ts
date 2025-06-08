import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import { goToDefinition } from "../../navigations/go_to_definition.ts";
import {
  findProjectForFile,
  getOrCreateSourceFileWithRefresh,
} from "../../utils/project_cache.ts";
import { resolveLineParameter } from "../line_utils.ts";
import type { ToolDef } from "../types.ts";

const schema = z.object({
  filePath: z
    .string()
    .describe("File path containing the symbol (relative to root)"),
  line: z
    .union([z.number(), z.string()])
    .describe("Line number (1-based) or string to match in the line"),
  symbolName: z.string().describe("Name of the symbol to get definitions for"),
  root: z.string().describe("Root directory for resolving relative paths"),
  before: z
    .number()
    .optional()
    .describe("Number of lines to show before the definition"),
  after: z
    .number()
    .optional()
    .describe("Number of lines to show after the definition"),
});

type Params = z.infer<typeof schema>;

export const getDefinitionsTool: ToolDef<Params, Params> = {
  name: "get_definitions",
  description: "Get the definition(s) of a TypeScript/JavaScript symbol",
  schema,
  handler: async ({ filePath, line, symbolName, root, before, after }) => {
    // Always treat paths as relative to root
    const absolutePath = path.join(root, filePath);

    // Check if file exists
    await fs.access(absolutePath);

    const project = await findProjectForFile(absolutePath);

    // Get the source file to find the column position with fresh content
    const sourceFile = await getOrCreateSourceFileWithRefresh(absolutePath);

    // Resolve line parameter
    const resolvedLine = resolveLineParameter(sourceFile, line);

    // Get the line text
    const fullText = sourceFile.getFullText();
    const lines = fullText.split("\n");
    const lineText = lines[resolvedLine - 1];

    if (!lineText) {
      throw new Error(`Invalid line number: ${resolvedLine}`);
    }

    // Find the column position of the symbol in the line
    const symbolIndex = lineText.indexOf(symbolName);
    if (symbolIndex === -1) {
      throw new Error(
        `Symbol "${symbolName}" not found on line ${resolvedLine}`
      );
    }

    // Convert to 1-based column (symbolIndex is 0-based)
    const column = symbolIndex + 1;

    // Find definition using the column position
    const result = goToDefinition(project, {
      filePath: absolutePath,
      line: resolvedLine,
      column,
    });

    if (result.isErr()) {
      throw new Error(result.error);
    }

    const { message, definitions, symbol } = result.value;

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
      if (before || after) {
        const defSourceFile = await getOrCreateSourceFileWithRefresh(
          def.filePath
        );
        if (defSourceFile) {
          const fullText = defSourceFile.getFullText();
          const lines = fullText.split("\n");

          const startLine = Math.max(0, def.line - 1 - (before || 0));
          const endLine = Math.min(lines.length, def.line + (after || 0));

          if (before && startLine < def.line - 1) {
            output.push("");
            for (let i = startLine; i < def.line - 1; i++) {
              output.push(`    ${i + 1}: ${lines[i]}`);
            }
          }

          // Show the definition line with arrow
          output.push(`  → ${def.line}: ${lines[def.line - 1]}`);

          if (after && def.line < endLine) {
            for (let i = def.line; i < endLine; i++) {
              output.push(`    ${i + 1}: ${lines[i]}`);
            }
          }
        }
      }
    }

    return output.join("\n");
  },
};
