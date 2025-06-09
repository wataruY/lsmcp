import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import {
  findProjectForFile,
  getOrCreateSourceFileWithRefresh,
} from "../utils/project_cache";
import { resolveLineParameter } from "../mcp/line_utils";
import type { ToolDef } from "../mcp/types";
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
  [SymbolMeaning.All]: ts.SymbolFlags.Value | ts.SymbolFlags.Type | ts.SymbolFlags.Namespace,
  [SymbolMeaning.Variable]: ts.SymbolFlags.Variable | ts.SymbolFlags.BlockScopedVariable | ts.SymbolFlags.FunctionScopedVariable,
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

function getSymbolKind(symbol: ts.Symbol): string {
  const flags = symbol.flags;
  
  if (flags & ts.SymbolFlags.Class) return "class";
  if (flags & ts.SymbolFlags.Interface) return "interface";
  if (flags & ts.SymbolFlags.TypeAlias) return "type alias";
  if (flags & ts.SymbolFlags.Enum) return "enum";
  if (flags & ts.SymbolFlags.Function) return "function";
  if (flags & ts.SymbolFlags.Method) return "method";
  if (flags & ts.SymbolFlags.Property) return "property";
  if (flags & ts.SymbolFlags.Variable) return "variable";
  if (flags & ts.SymbolFlags.BlockScopedVariable) return "variable";
  if (flags & ts.SymbolFlags.FunctionScopedVariable) return "variable";
  if (flags & ts.SymbolFlags.Module) return "module";
  if (flags & ts.SymbolFlags.Namespace) return "namespace";
  if (flags & ts.SymbolFlags.EnumMember) return "enum member";
  
  return "unknown";
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
    return COMMON_BUILTINS.includes(name as any);
  }
  
  return true;
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

  const project = await findProjectForFile(absolutePath);

  // Get the source file with fresh content
  const sourceFile = await getOrCreateSourceFileWithRefresh(absolutePath);

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
  if (symbolFlags === undefined) {
    throw new Error(`Invalid meaning: ${meaning}. Valid values are: ${Object.values(SymbolMeaning).join(", ")}`);
  }

  // Get symbols in scope
  const symbols = typeChecker.compilerObject.getSymbolsInScope(
    node.compilerNode,
    symbolFlags
  );

  // Process and categorize symbols
  const symbolsByKind: Record<string, SymbolInfo[]> = {};
  
  for (const symbol of symbols) {
    if (!shouldIncludeSymbol(symbol)) continue;
    
    const name = symbol.getName();
    const kind = getSymbolKind(symbol);
    
    // Get type information if available
    let typeText: string | undefined;
    try {
      const type = typeChecker.compilerObject.getTypeOfSymbolAtLocation(symbol, node.compilerNode);
      if (type) {
        typeText = typeChecker.compilerObject.typeToString(type);
        // Simplify long type names
        if (typeText && typeText.length > 100) {
          typeText = typeText.substring(0, 97) + "...";
        }
      }
    } catch {
      // Type resolution might fail for some symbols
    }
    
    // Get declaration location if available
    let declaration: { filePath: string; line: number } | undefined;
    const declarations = symbol.getDeclarations();
    if (declarations && declarations.length > 0) {
      const firstDecl = declarations[0];
      const declSourceFile = firstDecl.getSourceFile();
      const startPos = firstDecl.getStart ? firstDecl.getStart() : firstDecl.pos;
      const lineAndChar = declSourceFile.getLineAndCharacterOfPosition(startPos);
      declaration = {
        filePath: declSourceFile.fileName,
        line: lineAndChar.line + 1, // Convert to 1-based
      };
    }
    
    // Check if symbol is exported
    const isExported = (symbol.flags & ts.SymbolFlags.ExportValue) !== 0 || 
                      (symbol.flags & ts.SymbolFlags.Alias) !== 0;
    
    const symbolInfo: SymbolInfo = {
      name,
      kind,
      ...(typeText && { type: typeText }),
      exported: isExported,
      ...(declaration && { declaration }),
    };
    
    // Group by kind
    const categoryKey = getSymbolCategory(kind);
    if (!symbolsByKind[categoryKey]) {
      symbolsByKind[categoryKey] = [];
    }
    symbolsByKind[categoryKey].push(symbolInfo);
  }
  
  // Sort symbols within each category
  for (const category of Object.keys(symbolsByKind)) {
    symbolsByKind[category].sort((a, b) => a.name.localeCompare(b.name));
  }
  
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

function getSymbolCategory(kind: string): string {
  switch (kind) {
    case "variable":
    case "function":
    case "method":
    case "property":
      return "Variables & Functions";
    case "class":
      return "Classes";
    case "interface":
    case "type alias":
      return "Types & Interfaces";
    case "enum":
    case "enum member":
      return "Enums";
    case "module":
    case "namespace":
      return "Namespaces & Modules";
    default:
      return "Other";
  }
}

export function formatGetSymbolsInScopeResult(
  result: GetSymbolsInScopeResult,
  root: string
): string {
  const { location, meaning, symbolsByKind, totalCount } = result;
  const relativePath = path.relative(root, location.filePath);

  const output = [
    `Symbols in scope at ${relativePath}:${location.line}`,
    `Meaning: ${meaning}`,
    "",
  ];

  // Sort categories for consistent output
  const sortedCategories = Object.keys(symbolsByKind).sort();

  for (const category of sortedCategories) {
    const symbols = symbolsByKind[category];
    if (symbols.length === 0) continue;

    output.push(`${category} (${symbols.length}):`);
    
    for (const symbol of symbols) {
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
      
      output.push(line);
    }
    
    output.push("");
  }

  output.push(`Total: ${totalCount} symbols`);

  return output.join("\n");
}

export const getSymbolsInScopeTool: ToolDef<typeof schema> = {
  name: "get_symbols_in_scope",
  description:
    "Get all symbols (variables, types, functions, etc.) visible at a specific location in a TypeScript/JavaScript file",
  schema,
  handler: async (args) => {
    const result = await handleGetSymbolsInScope(args);
    return formatGetSymbolsInScopeResult(result, args.root);
  },
};