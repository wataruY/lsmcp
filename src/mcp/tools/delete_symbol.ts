import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import { deleteSymbol } from "../../commands/delete_symbol.ts";
import {
  findProjectForFile,
  getOrCreateSourceFileWithRefresh,
} from "../../utils/project_cache.ts";
import { resolveLineParameter } from "../line_utils.ts";
import type { ToolDef } from "../types.ts";

const schemaShape = {
  filePath: z
    .string()
    .describe("File path containing the symbol (relative to root)"),
  line: z
    .union([z.number(), z.string()])
    .describe("Line number (1-based) or string to match in the line"),
  symbolName: z.string().describe("Name of the symbol to delete"),
  removeReferences: z
    .boolean()
    .optional()
    .default(true)
    .describe("Also delete all references to the symbol"),
  root: z.string().describe("Root directory for resolving relative paths"),
};

const schema = z.object(schemaShape);

type InputParams = z.input<typeof schema>;
type OutputParams = z.output<typeof schema>;

export const deleteSymbolTool: ToolDef<InputParams, OutputParams> = {
  name: "delete_symbol",
  description:
    "Delete a TypeScript/JavaScript symbol (variable, function, class, etc.) and all its references",
  schema,
  handler: async ({ filePath, line, symbolName, root, removeReferences }) => {
    // Always treat paths as relative to root
    const absolutePath = path.join(root, filePath);

    // Check if file exists
    await fs.access(absolutePath);

    const project = await findProjectForFile(absolutePath);

    // Ensure the source file is loaded in the project with fresh content
    const sourceFile = await getOrCreateSourceFileWithRefresh(absolutePath);

    // Resolve line parameter
    const resolvedLine = resolveLineParameter(sourceFile, line);

    // Perform the removal
    const result = await deleteSymbol(project, {
      filePath: absolutePath,
      line: resolvedLine,
      symbolName,
    });

    if (result.isErr()) {
      throw new Error(result.error);
    }

    // Save all changes
    await project.save();
    const { message, removedFromFiles } = result.value;
    return `${message} from ${removedFromFiles.length} file(s).`;
  },
};
