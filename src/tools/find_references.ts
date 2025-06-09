import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import { findReferences } from "../navigations/find_references";
import {
  findProjectForFile,
  getOrCreateSourceFileWithRefresh,
} from "../utils/project_cache";
import { resolveLineParameter, findSymbolInLine } from "../mcp/line_utils";
import type { ToolDef } from "../mcp/types";

const schema = z.object({
  root: z.string().describe("Root directory for resolving relative paths"),
  filePath: z
    .string()
    .describe("File path containing the symbol (relative to root)"),
  line: z
    .union([z.number(), z.string()])
    .describe("Line number (1-based) or string to match in the line"),
  symbolName: z.string().describe("Name of the symbol to find references for"),
});

export interface FindReferencesResult {
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

export async function handleFindReferences({
  root,
  filePath,
  line,
  symbolName,
}: z.infer<typeof schema>): Promise<FindReferencesResult> {
  // Always treat paths as relative to root
  const absolutePath = path.join(root, filePath);

  // Check if file exists
  await fs.access(absolutePath);

  const project = findProjectForFile(absolutePath);

  // Ensure the source file is loaded in the project with fresh content
  const sourceFile = await getOrCreateSourceFileWithRefresh(absolutePath);

  // Resolve line parameter
  const resolvedLine = resolveLineParameter(sourceFile, line);

  // Find the symbol in the line and get column position
  const { column } = findSymbolInLine(sourceFile, resolvedLine, symbolName);

  // Find references
  const result = findReferences(project, {
    filePath: absolutePath,
    line: resolvedLine,
    column,
  });

  if (result.isErr()) {
    throw new Error(result.error);
  }

  return result.value;
}

export function formatFindReferencesResult(
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
    const relativePath = path.relative(root, ref.filePath);
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
  handler: async (args) => {
    const result = await handleFindReferences(args);
    return formatFindReferencesResult(result, args.root);
  },
};