import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import {
  findProjectForFile,
  getOrCreateSourceFileWithRefresh,
} from "../project_cache";
import { resolveLineParameter, findSymbolInLine } from "../../mcp/line_utils";
import type { ToolDef } from "../../mcp/types";
import { ts, type SourceFile, type Node, type Symbol } from "ts-morph";

const schema = z.object({
  root: z.string().describe("Root directory for resolving relative paths"),
  filePath: z
    .string()
    .describe("File path containing the symbol (relative to root)"),
  line: z
    .union([z.number(), z.string()])
    .describe("Line number (1-based) or string to match in the line"),
  symbolName: z
    .string()
    .describe("Name of the symbol to get type information for"),
  symbolIndex: z
    .number()
    .optional()
    .default(0)
    .describe(
      "Index of the symbol occurrence if it appears multiple times on the line (0-based)"
    ),
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

const symbolFlagToKind: Array<[number, string]> = [
  [ts.SymbolFlags.Function, "function"],
  [ts.SymbolFlags.Method, "method"],
  [ts.SymbolFlags.Class, "class"],
  [ts.SymbolFlags.Interface, "interface"],
  [ts.SymbolFlags.TypeAlias, "type alias"],
  [ts.SymbolFlags.Variable, "variable"],
  [ts.SymbolFlags.Property, "property"],
  [ts.SymbolFlags.BlockScopedVariable, "variable"],
  [ts.SymbolFlags.FunctionScopedVariable, "variable"],
  [ts.SymbolFlags.Enum, "enum"],
  [ts.SymbolFlags.EnumMember, "enum member"],
];

function getSymbolKind(flags: ts.SymbolFlags): string {
  const match = symbolFlagToKind.find(([flag]) => flags & flag);
  return match ? match[1] : "unknown";
}

function getSymbolDocumentation(symbol: Symbol): string | undefined {
  const jsDocTags = symbol.getJsDocTags();
  if (jsDocTags.length === 0) return undefined;

  return jsDocTags
    .map((tag) => {
      const tagName = tag.getName();
      const tagTextParts = tag.getText();
      // getText() returns SymbolDisplayPart[] which we need to join
      const textContent = tagTextParts
        .map((part) => part.text)
        .join("")
        .trim();
      return textContent ? `@${tagName} ${textContent}` : `@${tagName}`;
    })
    .join("\n");
}

async function validateAndGetSourceFile(
  root: string,
  filePath: string
): Promise<{
  absolutePath: string;
  sourceFile: SourceFile;
}> {
  const absolutePath = path.join(root, filePath);
  await fs.access(absolutePath);
  findProjectForFile(absolutePath);
  return {
    absolutePath,
    sourceFile: getOrCreateSourceFileWithRefresh(absolutePath),
  };
}

function getNodeAtPosition(
  sourceFile: SourceFile,
  line: number,
  column: number
): Node {
  const position = sourceFile.compilerNode.getPositionOfLineAndCharacter(
    line - 1, // Convert to 0-based
    column - 1 // Convert to 0-based
  );

  const node = sourceFile.getDescendantAtPos(position);
  if (!node) {
    throw new Error(
      `No node found at position ${String(line)}:${String(column)}`
    );
  }
  return node;
}

function getSymbolFromNode(
  node: Node,
  symbolName: string,
  line: number,
  column: number
): Symbol {
  const symbol = node.getSymbol();
  if (!symbol) {
    throw new Error(
      `No symbol found for "${symbolName}" at ${String(line)}:${String(column)}`
    );
  }
  return symbol;
}

export async function handleGetTypeAtSymbol({
  root,
  filePath,
  line,
  symbolName,
  symbolIndex = 0,
}: z.infer<typeof schema>): Promise<GetTypeAtSymbolResult> {
  // Validate file and get source file
  const { absolutePath, sourceFile } = await validateAndGetSourceFile(
    root,
    filePath
  );

  // Resolve line parameter
  const resolvedLine = resolveLineParameter(sourceFile, line);

  // Find the symbol in the line and get column position
  const { column } = findSymbolInLine(
    sourceFile,
    resolvedLine,
    symbolName,
    symbolIndex
  );

  // Get the node at the position
  const node = getNodeAtPosition(sourceFile, resolvedLine, column);

  // Get symbol information
  const symbol = getSymbolFromNode(node, symbolName, resolvedLine, column);

  // Get type information
  const type = node.getType();
  const typeText = type.getText(node);

  // Get documentation and kind
  const documentation = getSymbolDocumentation(symbol);
  const kind = getSymbolKind(symbol.compilerSymbol.flags);

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
  execute: async (args) => {
    const result = await handleGetTypeAtSymbol(args);
    return formatGetTypeAtSymbolResult(result, args.root);
  },
};
