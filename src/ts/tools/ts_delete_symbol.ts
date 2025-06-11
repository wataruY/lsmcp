import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import { deleteSymbol } from "../commands/delete_symbol";
import {
  findProjectForFile,
  getOrCreateSourceFileWithRefresh,
} from "../project_cache";
import { resolveLineParameter } from "../../mcp/line_utils";
import type { ToolDef } from "../../mcp/types";

const schemaShape = {
  root: z.string().describe("Root directory for resolving relative paths"),
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
};

const schema = z.object(schemaShape);

export interface DeleteSymbolResult {
  message: string;
  removedFromFiles: string[];
}

export async function handleDeleteSymbol({
  root,
  filePath,
  line,
  symbolName,
}: z.infer<typeof schema>): Promise<DeleteSymbolResult> {
  // Always treat paths as relative to root
  const absolutePath = path.join(root, filePath);

  // Check if file exists
  await fs.access(absolutePath);

  const project = findProjectForFile(absolutePath);

  // Ensure the source file is loaded in the project with fresh content
  const sourceFile = getOrCreateSourceFileWithRefresh(absolutePath);

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

  return result.value;
}

export function formatDeleteSymbolResult(result: DeleteSymbolResult): string {
  const { message, removedFromFiles } = result;
  return `${message} from ${removedFromFiles.length} file(s).`;
}

export const deleteSymbolTool: ToolDef<typeof schema> = {
  name: "delete_symbol",
  description:
    "Delete a TypeScript/JavaScript symbol (variable, function, class, etc.) and all its references",
  schema,
  execute: async (args) => {
    const result = await handleDeleteSymbol(args);
    return formatDeleteSymbolResult(result);
  },
};
