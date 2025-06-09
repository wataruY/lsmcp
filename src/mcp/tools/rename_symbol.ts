import { z } from "zod";
import path from "path";
import { renameSymbol } from "../../commands/rename_symbol.ts";
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
  oldName: z.string().describe("Current name of the symbol"),
  newName: z.string().describe("New name for the symbol"),
  root: z.string().describe("Root directory for resolving relative paths"),
});

export const renameSymbolTool: ToolDef<typeof schema> = {
  name: "rename_symbol",
  description:
    "Rename a TypeScript/JavaScript symbol (variable, function, class, etc.) across the codebase",
  schema,
  handler: async ({ filePath, line, oldName, newName, root }) => {
    // Always treat paths as relative to root
    const absolutePath = path.join(root, filePath);
    // Check if file exists
    const project = await findProjectForFile(absolutePath);

    // Ensure the source file is loaded in the project with fresh content
    const sourceFile = await getOrCreateSourceFileWithRefresh(absolutePath);

    // Resolve line parameter
    const resolvedLine = resolveLineParameter(sourceFile, line);

    // Perform the rename
    const result = await renameSymbol(project, {
      filePath: absolutePath,
      line: resolvedLine,
      symbolName: oldName,
      newName,
      renameInStrings: true,
      renameInComments: false,
    });

    if (result.isErr()) {
      throw new Error(result.error);
    }

    // Save all changes
    await project.save();

    const { message, changedFiles } = result.value;
    return `${message} in ${changedFiles.length} file(s).`;
  },
};
