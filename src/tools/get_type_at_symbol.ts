import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import {
  findProjectForFile,
  getOrCreateSourceFileWithRefresh,
} from "../utils/project_cache";
import { resolveLineParameter, findSymbolInLine } from "../mcp/line_utils";
import type { ToolDef } from "../mcp/types";
import { ts } from "ts-morph";

const schema = z.object({
  root: z.string().describe("Root directory for resolving relative paths"),
  filePath: z
    .string()
    .describe("File path containing the symbol (relative to root)"),
  line: z
    .union([z.number(), z.string()])
    .describe("Line number (1-based) or string to match in the line"),
  symbolName: z.string().describe("Name of the symbol to get type information for"),
  symbolIndex: z
    .number()
    .optional()
    .default(0)
    .describe("Index of the symbol occurrence if it appears multiple times on the line (0-based)"),
});

export interface GetTypeAtSymbolResult {
  symbol: {
    name: string;
    kind: string;
  };
  type: string;
  documentation?: string;
  location: {
    filePath: string;
    line: number;
    column: number;
  };
}

export async function handleGetTypeAtSymbol({
  root,
  filePath,
  line,
  symbolName,
  symbolIndex = 0,
}: z.infer<typeof schema>): Promise<GetTypeAtSymbolResult> {
  // Always treat paths as relative to root
  const absolutePath = path.join(root, filePath);

  // Check if file exists
  await fs.access(absolutePath);

  findProjectForFile(absolutePath);

  // Get the source file to find the symbol position with fresh content
  const sourceFile = await getOrCreateSourceFileWithRefresh(absolutePath);

  // Resolve line parameter
  const resolvedLine = resolveLineParameter(sourceFile, line);

  // Find the symbol in the line and get column position
  const { column } = findSymbolInLine(sourceFile, resolvedLine, symbolName, symbolIndex);

  // Convert line/column to position
  const position = sourceFile.compilerNode.getPositionOfLineAndCharacter(
    resolvedLine - 1,  // Convert to 0-based
    column - 1         // Convert to 0-based
  );

  // Get the node at this position
  const node = sourceFile.getDescendantAtPos(position);
  if (!node) {
    throw new Error(`No node found at position ${resolvedLine}:${column}`);
  }

  // Get symbol information
  const symbol = node.getSymbol();
  if (!symbol) {
    throw new Error(`No symbol found for "${symbolName}" at ${resolvedLine}:${column}`);
  }

  // Get type information
  const type = node.getType();
  const typeText = type.getText(node);

  // Get documentation if available
  const jsDocTags = symbol.getJsDocTags();
  const documentation = jsDocTags.length > 0
    ? jsDocTags.map(tag => `@${tag.getName()} ${tag.getText()}`).join('\n')
    : undefined;

  // Get symbol kind
  const symbolFlags = symbol.getFlags();
  let kind = "unknown";
  
  if (symbolFlags & ts.SymbolFlags.Function) kind = "function";
  else if (symbolFlags & ts.SymbolFlags.Method) kind = "method";
  else if (symbolFlags & ts.SymbolFlags.Class) kind = "class";
  else if (symbolFlags & ts.SymbolFlags.Interface) kind = "interface";
  else if (symbolFlags & ts.SymbolFlags.TypeAlias) kind = "type alias";
  else if (symbolFlags & ts.SymbolFlags.Variable) kind = "variable";
  else if (symbolFlags & ts.SymbolFlags.Property) kind = "property";
  else if (symbolFlags & ts.SymbolFlags.BlockScopedVariable) kind = "variable";
  else if (symbolFlags & ts.SymbolFlags.FunctionScopedVariable) kind = "variable";
  else if (symbolFlags & ts.SymbolFlags.Enum) kind = "enum";
  else if (symbolFlags & ts.SymbolFlags.EnumMember) kind = "enum member";

  return {
    symbol: {
      name: symbol.getName(),
      kind,
    },
    type: typeText,
    documentation,
    location: {
      filePath: absolutePath,
      line: resolvedLine,
      column,
    },
  };
}

export function formatGetTypeAtSymbolResult(
  result: GetTypeAtSymbolResult,
  root: string
): string {
  const { symbol, type, documentation, location } = result;
  const relativePath = path.relative(root, location.filePath);

  const output = [
    `Type information for "${symbol.name}" (${symbol.kind})`,
    `Location: ${relativePath}:${location.line}:${location.column}`,
    "",
    `Type: ${type}`,
  ];

  if (documentation) {
    output.push("");
    output.push("Documentation:");
    output.push(documentation);
  }

  return output.join("\n");
}

export const getTypeAtSymbolTool: ToolDef<typeof schema> = {
  name: "get_type_at_symbol",
  description:
    "Get type information for a TypeScript/JavaScript symbol at a specific location",
  schema,
  handler: async (args) => {
    const result = await handleGetTypeAtSymbol(args);
    return formatGetTypeAtSymbolResult(result, args.root);
  },
};