import { z } from "zod";
import { CompletionItem, CompletionItemKind } from "vscode-languageserver-types";
import type { ToolDef } from "../../mcp/_mcplib.ts";
import { getLSPClient } from "../lspClient.ts";
import { prepareFileContext, withLSPDocument, resolveLineOrThrow } from "./lspCommon.ts";
import { commonSchemas } from "../../common/schemas.ts";

const schema = z.object({
  root: commonSchemas.root,
  filePath: commonSchemas.filePath,
  line: commonSchemas.line,
  character: commonSchemas.character,
});

function getCompletionItemKindName(kind?: CompletionItemKind): string {
  if (!kind) return "Unknown";
  
  const kindNames: Record<CompletionItemKind, string> = {
    [CompletionItemKind.Text]: "Text",
    [CompletionItemKind.Method]: "Method",
    [CompletionItemKind.Function]: "Function",
    [CompletionItemKind.Constructor]: "Constructor",
    [CompletionItemKind.Field]: "Field",
    [CompletionItemKind.Variable]: "Variable",
    [CompletionItemKind.Class]: "Class",
    [CompletionItemKind.Interface]: "Interface",
    [CompletionItemKind.Module]: "Module",
    [CompletionItemKind.Property]: "Property",
    [CompletionItemKind.Unit]: "Unit",
    [CompletionItemKind.Value]: "Value",
    [CompletionItemKind.Enum]: "Enum",
    [CompletionItemKind.Keyword]: "Keyword",
    [CompletionItemKind.Snippet]: "Snippet",
    [CompletionItemKind.Color]: "Color",
    [CompletionItemKind.File]: "File",
    [CompletionItemKind.Reference]: "Reference",
    [CompletionItemKind.Folder]: "Folder",
    [CompletionItemKind.EnumMember]: "EnumMember",
    [CompletionItemKind.Constant]: "Constant",
    [CompletionItemKind.Struct]: "Struct",
    [CompletionItemKind.Event]: "Event",
    [CompletionItemKind.Operator]: "Operator",
    [CompletionItemKind.TypeParameter]: "TypeParameter",
  };
  
  return kindNames[kind] || "Unknown";
}

function formatCompletionItem(item: CompletionItem): string {
  const kind = getCompletionItemKindName(item.kind);
  let result = `${item.label} [${kind}]`;
  
  if (item.detail) {
    result += `\n${item.detail}`;
  }
  
  if (item.documentation) {
    const doc = typeof item.documentation === "string"
      ? item.documentation
      : item.documentation.value;
    if (doc) {
      // Truncate long documentation
      const maxDocLength = 200;
      const truncatedDoc = doc.length > maxDocLength
        ? doc.substring(0, maxDocLength) + "..."
        : doc;
      result += `\n\n${truncatedDoc}`;
    }
  }
  
  return result;
}

async function handleGetCompletion({
  root,
  filePath,
  line,
  character,
}: z.infer<typeof schema>): Promise<string> {
  const { fileUri, content } = await prepareFileContext(root, filePath);
  const lineIndex = resolveLineOrThrow(content, line, filePath);

  return withLSPDocument(fileUri, content, async () => {
    const client = getLSPClient();
    if (!client) {
      throw new Error("LSP client not initialized");
    }

    // Get completions
    const completions = await client.getCompletion(fileUri, {
      line: lineIndex,
      character,
    });

    if (completions.length === 0) {
      return `No completions available at ${filePath}:${lineIndex + 1}:${character + 1}`;
    }

    // Sort completions by relevance (sortText if available, otherwise by label)
    const sortedCompletions = completions.sort((a, b) => {
      if (a.sortText && b.sortText) {
        return a.sortText.localeCompare(b.sortText);
      }
      return a.label.localeCompare(b.label);
    });

    // Take top 20 completions
    const topCompletions = sortedCompletions.slice(0, 20);

    // Format the completions
    let result = `Completions at ${filePath}:${lineIndex + 1}:${character + 1}:\n\n`;
    
    for (const item of topCompletions) {
      result += formatCompletionItem(item) + "\n\n";
    }
    
    if (completions.length > 20) {
      result += `... and ${completions.length - 20} more completions`;
    }

    return result.trim();
  });
}

export const lspGetCompletionTool: ToolDef<typeof schema> = {
  name: "lsp_get_completion",
  description:
    "Get code completion suggestions at a specific position in a file using LSP",
  schema,
  execute: async (args) => {
    return handleGetCompletion(args);
  },
};