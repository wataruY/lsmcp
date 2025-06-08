import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import { findReferences } from "../../navigations/find_references.ts";
import { findProjectForFile } from "../../utils/project_cache.ts";
import { resolveLineParameter } from "../line_utils.ts";
import type { ToolDef } from "../types.ts";

const schema = z.object({
  filePath: z
    .string()
    .describe("File path containing the symbol (relative to root)"),
  line: z
    .union([z.number(), z.string()])
    .describe("Line number (1-based) or string to match in the line"),
  symbolName: z
    .string()
    .describe("Name of the symbol to find references for"),
  root: z.string().describe("Root directory for resolving relative paths"),
});

type Params = z.infer<typeof schema>;

export const findReferencesTool: ToolDef<Params, Params> = {
  name: "find_references",
  description: "Find all references to a TypeScript/JavaScript symbol across the codebase",
  schema,
  handler: async ({ filePath, line, symbolName, root }) => {
      // Always treat paths as relative to root
      const absolutePath = path.join(root, filePath);

      // Check if file exists
      await fs.access(absolutePath);

      const project = await findProjectForFile(absolutePath);

      // Ensure the source file is loaded in the project
      let sourceFile = project.getSourceFile(absolutePath);
      if (!sourceFile) {
        // Try to add the file if it's not in the project (e.g., excluded in tsconfig)
        try {
          sourceFile = project.addSourceFileAtPath(absolutePath);
        } catch (error) {
          throw new Error(`File not found: ${absolutePath}`);
        }
      }

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
        throw new Error(`Symbol "${symbolName}" not found on line ${resolvedLine}`);
      }

      // Convert to 1-based column (symbolIndex is 0-based)
      const column = symbolIndex + 1;

      // Find references
      const result = findReferences(project, {
        filePath: absolutePath,
        line: resolvedLine,
        column,
      });

      if (result.isErr()) {
        throw new Error(result.error);
      }

      const { message, references, symbol } = result.value;

      // Format the output
      const output = [
        message,
        `Symbol: ${symbol.name} (${symbol.kind})`,
        "",
        "References:",
      ];

      for (const ref of references) {
        const relativePath = path.relative(root, ref.filePath);
        output.push(
          `  ${relativePath}:${ref.line}:${ref.column} - ${ref.lineText}`
        );
      }

      return output.join("\n");
  },
};