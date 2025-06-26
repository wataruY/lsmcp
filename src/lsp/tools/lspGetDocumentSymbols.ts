import { z } from "zod";
import { DocumentSymbol, SymbolInformation, SymbolKind } from "vscode-languageserver-types";
import type { ToolDef } from "../../mcp/_mcplib.ts";
import { prepareFileContext, withLSPDocument } from "./lspCommon.ts";
import { fileLocationSchema } from "../../common/schemas.ts";
import { formatLocation, formatRange } from "../../common/formatting.ts";
import { getLSPClient } from "../lspClient.ts";

const schema = fileLocationSchema;

function getSymbolKindName(kind: SymbolKind): string {
  const symbolKindNames: Record<SymbolKind, string> = {
    [SymbolKind.File]: "File",
    [SymbolKind.Module]: "Module",
    [SymbolKind.Namespace]: "Namespace",
    [SymbolKind.Package]: "Package",
    [SymbolKind.Class]: "Class",
    [SymbolKind.Method]: "Method",
    [SymbolKind.Property]: "Property",
    [SymbolKind.Field]: "Field",
    [SymbolKind.Constructor]: "Constructor",
    [SymbolKind.Enum]: "Enum",
    [SymbolKind.Interface]: "Interface",
    [SymbolKind.Function]: "Function",
    [SymbolKind.Variable]: "Variable",
    [SymbolKind.Constant]: "Constant",
    [SymbolKind.String]: "String",
    [SymbolKind.Number]: "Number",
    [SymbolKind.Boolean]: "Boolean",
    [SymbolKind.Array]: "Array",
    [SymbolKind.Object]: "Object",
    [SymbolKind.Key]: "Key",
    [SymbolKind.Null]: "Null",
    [SymbolKind.EnumMember]: "EnumMember",
    [SymbolKind.Struct]: "Struct",
    [SymbolKind.Event]: "Event",
    [SymbolKind.Operator]: "Operator",
    [SymbolKind.TypeParameter]: "TypeParameter",
  };
  return symbolKindNames[kind] || "Unknown";
}

function formatDocumentSymbol(
  symbol: DocumentSymbol,
  indent: string = ""
): string {
  const kind = getSymbolKindName(symbol.kind);
  const deprecated = symbol.deprecated ? " (deprecated)" : "";
  let result = `${indent}${symbol.name} [${kind}]${deprecated}`;
  
  if (symbol.detail) {
    result += ` - ${symbol.detail}`;
  }
  
  result += `\n${indent}  Range: ${formatRange(symbol.range)}`;
  
  if (symbol.children && symbol.children.length > 0) {
    result += "\n";
    for (const child of symbol.children) {
      result += "\n" + formatDocumentSymbol(child, indent + "  ");
    }
  }
  
  return result;
}

function formatSymbolInformation(symbol: SymbolInformation): string {
  const kind = getSymbolKindName(symbol.kind);
  const deprecated = symbol.deprecated ? " (deprecated)" : "";
  const container = symbol.containerName ? ` in ${symbol.containerName}` : "";
  
  return `${symbol.name} [${kind}]${deprecated}${container}
  ${formatLocation(symbol.location)}`;
}

async function handleGetDocumentSymbols({
  root,
  filePath,
}: z.infer<typeof schema>): Promise<string> {
  const { fileUri, content } = await prepareFileContext(root, filePath);

  return withLSPDocument(fileUri, content, async () => {
    const client = getLSPClient();
    if (!client) {
      throw new Error("LSP client not initialized");
    }

    // Get document symbols
    const symbols = await client.getDocumentSymbols(fileUri);

    if (symbols.length === 0) {
      return `No symbols found in ${filePath}`;
    }

    // Format the symbols
    let result = `Document symbols in ${filePath}:\n\n`;
    
    // Check if we have DocumentSymbol[] or SymbolInformation[]
    if ("children" in symbols[0]) {
      // DocumentSymbol[] - hierarchical format
      for (const symbol of symbols as DocumentSymbol[]) {
        result += formatDocumentSymbol(symbol) + "\n\n";
      }
    } else {
      // SymbolInformation[] - flat format
      for (const symbol of symbols as SymbolInformation[]) {
        result += formatSymbolInformation(symbol) + "\n\n";
      }
    }

    return result.trim();
  });
}

export const lspGetDocumentSymbolsTool: ToolDef<typeof schema> = {
  name: "lsmcp_get_document_symbols",
  description:
    "Get all symbols (functions, classes, variables, etc.) in a document using LSP",
  schema,
  execute: async (args) => {
    return handleGetDocumentSymbols(args);
  },
};