import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import {
  findProjectForFile,
  getOrCreateSourceFileWithRefresh,
} from "../projectCache";
import { resolveLineParameterForSourceFile as resolveLineParameter } from "../../textUtils/resolveLineParameterForSourceFile";
import type { ToolDef } from "../../mcp/types";
import { ts } from "ts-morph";

// Define the meaning enum
export enum SymbolMeaning {
  Value = "Value",
  Type = "Type",
  Namespace = "Namespace",
  All = "All",
  Variable = "Variable",
  Function = "Function",
  Class = "Class",
  Interface = "Interface",
  TypeAlias = "TypeAlias",
  Enum = "Enum",
  Module = "Module",
}

const schema = z.object({
  root: z.string().describe("Root directory for resolving relative paths"),
  filePath: z
    .string()
    .describe("File path containing the location (relative to root)"),
  line: z
    .union([z.number(), z.string()])
    .describe("Line number (1-based) or string to match in the line"),
  meaning: z
    .nativeEnum(SymbolMeaning)
    .optional()
    .default(SymbolMeaning.All)
    .describe("Symbol types to include"),
});

// Map enum values to TypeScript SymbolFlags
const meaningMap: Record<SymbolMeaning, ts.SymbolFlags> = {
  [SymbolMeaning.Value]: ts.SymbolFlags.Value,
  [SymbolMeaning.Type]: ts.SymbolFlags.Type,
  [SymbolMeaning.Namespace]: ts.SymbolFlags.Namespace,
  [SymbolMeaning.All]:
    ts.SymbolFlags.Value | ts.SymbolFlags.Type | ts.SymbolFlags.Namespace,
  [SymbolMeaning.Variable]:
    ts.SymbolFlags.Variable |
    ts.SymbolFlags.BlockScopedVariable |
    ts.SymbolFlags.FunctionScopedVariable,
  [SymbolMeaning.Function]: ts.SymbolFlags.Function,
  [SymbolMeaning.Class]: ts.SymbolFlags.Class,
  [SymbolMeaning.Interface]: ts.SymbolFlags.Interface,
  [SymbolMeaning.TypeAlias]: ts.SymbolFlags.TypeAlias,
  [SymbolMeaning.Enum]: ts.SymbolFlags.Enum,
  [SymbolMeaning.Module]: ts.SymbolFlags.Module,
};

export interface SymbolInfo {
  name: string;
  kind: string;
  type?: string;
  exported: boolean;
  declaration?: {
    filePath: string;
    line: number;
  };
}

export interface GetSymbolsInScopeResult {
  location: {
    filePath: string;
    line: number;
  };
  meaning: SymbolMeaning;
  symbolsByKind: Record<string, SymbolInfo[]>;
  totalCount: number;
}

const symbolFlagToKind: Array<[number, string]> = [
  [ts.SymbolFlags.Class, "class"],
  [ts.SymbolFlags.Interface, "interface"],
  [ts.SymbolFlags.TypeAlias, "type alias"],
  [ts.SymbolFlags.Enum, "enum"],
  [ts.SymbolFlags.Function, "function"],
  [ts.SymbolFlags.Method, "method"],
  [ts.SymbolFlags.Property, "property"],
  [ts.SymbolFlags.Variable, "variable"],
  [ts.SymbolFlags.BlockScopedVariable, "variable"],
  [ts.SymbolFlags.FunctionScopedVariable, "variable"],
  [ts.SymbolFlags.Module, "module"],
  [ts.SymbolFlags.Namespace, "namespace"],
  [ts.SymbolFlags.EnumMember, "enum member"],
];

function getSymbolKind(symbol: ts.Symbol): string {
  const flags = symbol.flags;
  const match = symbolFlagToKind.find(([flag]) => flags & flag);
  return match ? match[1] : "unknown";
}

// Common built-in symbols that should be included even without declarations
const COMMON_BUILTINS = [
  "console",
  "process",
  "global",
  "Buffer",
  "Promise",
  "Array",
  "Object",
  "String",
  "Number",
  "Boolean",
  "Date",
  "RegExp",
  "Error",
  "Map",
  "Set",
  "WeakMap",
  "WeakSet",
  "Symbol",
  "JSON",
  "Math",
] as const;

function shouldIncludeSymbol(symbol: ts.Symbol): boolean {
  const name = symbol.getName();

  // Skip compiler-internal symbols
  if (name.startsWith("__")) return false;
  if (name === "undefined" || name === "null") return false;

  // Skip symbols without declarations (usually built-ins we want to keep)
  const declarations = symbol.getDeclarations();
  if (!declarations || declarations.length === 0) {
    // Keep common built-ins
    return COMMON_BUILTINS.includes(name as (typeof COMMON_BUILTINS)[number]);
  }

  return true;
}

function getTypeText(
  symbol: ts.Symbol,
  typeChecker: ts.TypeChecker,
  node: ts.Node
): string | undefined {
  try {
    const type = typeChecker.getTypeOfSymbolAtLocation(symbol, node);
    const typeText = typeChecker.typeToString(type);
    // Simplify long type names
    return typeText.length > 100 ? typeText.substring(0, 97) + "..." : typeText;
  } catch {
    // Type resolution might fail for some symbols
    return undefined;
  }
}

function getDeclarationInfo(
  symbol: ts.Symbol
): { filePath: string; line: number } | undefined {
  const declarations = symbol.getDeclarations();
  if (!declarations || declarations.length === 0) return undefined;

  const firstDecl = declarations[0];
  const declSourceFile = firstDecl.getSourceFile();
  const startPos = firstDecl.getStart();
  const lineAndChar = declSourceFile.getLineAndCharacterOfPosition(startPos);

  return {
    filePath: declSourceFile.fileName,
    line: lineAndChar.line + 1, // Convert to 1-based
  };
}

function createSymbolInfo(
  symbol: ts.Symbol,
  typeChecker: import("ts-morph").TypeChecker,
  node: import("ts-morph").Node
): SymbolInfo {
  const name = symbol.getName();
  const kind = getSymbolKind(symbol);
  const typeText = getTypeText(
    symbol,
    typeChecker.compilerObject,
    node.compilerNode
  );
  const declaration = getDeclarationInfo(symbol);
  const isExported =
    (symbol.flags & ts.SymbolFlags.ExportValue) !== 0 ||
    (symbol.flags & ts.SymbolFlags.Alias) !== 0;

  return {
    name,
    kind,
    ...(typeText && { type: typeText }),
    exported: isExported,
    ...(declaration && { declaration }),
  };
}

export async function handleGetSymbolsInScope({
  root,
  filePath,
  line,
  meaning = SymbolMeaning.All,
}: z.infer<typeof schema>): Promise<GetSymbolsInScopeResult> {
  // Always treat paths as relative to root
  const absolutePath = path.join(root, filePath);

  // Check if file exists
  await fs.access(absolutePath);

  const project = findProjectForFile(absolutePath);

  // Get the source file with fresh content
  const sourceFile = getOrCreateSourceFileWithRefresh(absolutePath);

  // Resolve line parameter
  const resolvedLine = resolveLineParameter(sourceFile, line);

  // Get the TypeChecker
  const typeChecker = project.getTypeChecker();

  // Get position at the beginning of the line
  const position = sourceFile.compilerNode.getPositionOfLineAndCharacter(
    resolvedLine - 1, // Convert to 0-based
    0
  );

  // Get the node at this position
  const node = sourceFile.getDescendantAtPos(position);
  if (!node) {
    throw new Error(`No node found at line ${resolvedLine}`);
  }

  // Get the symbol flags for the requested meaning
  const symbolFlags = meaningMap[meaning];

  // Get symbols in scope
  const symbols = typeChecker.compilerObject.getSymbolsInScope(
    node.compilerNode,
    symbolFlags
  );

  // Process symbols into SymbolInfo objects
  const processedSymbols = symbols
    .filter(shouldIncludeSymbol)
    .map((symbol) => createSymbolInfo(symbol, typeChecker, node));

  // Group symbols by category
  const symbolsByKind = Object.groupBy(processedSymbols, (symbolInfo) =>
    getSymbolCategory(symbolInfo.kind)
  ) as Record<string, SymbolInfo[]>;

  // Sort symbols within each category
  Object.keys(symbolsByKind).forEach((category) => {
    symbolsByKind[category].sort((a, b) => a.name.localeCompare(b.name));
  });

  // Count total symbols
  const totalCount = Object.values(symbolsByKind).reduce(
    (sum, symbols) => sum + symbols.length,
    0
  );

  return {
    location: {
      filePath: absolutePath,
      line: resolvedLine,
    },
    meaning,
    symbolsByKind,
    totalCount,
  };
}

const kindToCategory: Record<string, string> = {
  variable: "Variables & Functions",
  function: "Variables & Functions",
  method: "Variables & Functions",
  property: "Variables & Functions",
  class: "Classes",
  interface: "Types & Interfaces",
  "type alias": "Types & Interfaces",
  enum: "Enums",
  "enum member": "Enums",
  module: "Namespaces & Modules",
  namespace: "Namespaces & Modules",
};

function getSymbolCategory(kind: string): string {
  return kindToCategory[kind] || "Other";
}

function formatSymbolLine(symbol: SymbolInfo): string {
  let line = `  - ${symbol.name}`;

  if (symbol.kind !== "variable" && symbol.kind !== "function") {
    line += ` (${symbol.kind})`;
  }

  if (symbol.type) {
    line += `: ${symbol.type}`;
  }

  if (symbol.exported) {
    line += " [exported]";
  }

  return line;
}

export function formatGetSymbolsInScopeResult(
  result: GetSymbolsInScopeResult,
  root: string
): string {
  const { location, meaning, symbolsByKind, totalCount } = result;
  const relativePath = path.relative(root, location.filePath);

  const header = [
    `Symbols in scope at ${relativePath}:${location.line}`,
    `Meaning: ${meaning}`,
    "",
  ];

  // Sort categories and format each one
  const categoryBlocks = Object.entries(symbolsByKind)
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([, symbols]) => symbols.length > 0)
    .flatMap(([category, symbols]) => [
      `${category} (${symbols.length}):`,
      ...symbols.map(formatSymbolLine),
      "",
    ]);

  const footer = [`Total: ${totalCount} symbols`];

  return [...header, ...categoryBlocks, ...footer].join("\n");
}

export const getSymbolsInScopeTool: ToolDef<typeof schema> = {
  name: "get_symbols_in_scope",
  description:
    "Get all symbols (variables, types, functions, etc.) visible at a specific location in a TypeScript/JavaScript file",
  schema,
  execute: async (args) => {
    const result = await handleGetSymbolsInScope(args);
    return formatGetSymbolsInScopeResult(result, args.root);
  },
};
