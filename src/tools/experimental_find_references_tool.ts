import { type Result, ok, err } from "neverthrow";
import { readFileSync } from "fs";
import { relative } from "path";
import {
  type LSPToolRequest,
  type McpToolResult,
  setupLSPRequest,
  formatMcpResult,
} from "./lsp_common.ts";

interface FindReferencesRequest extends LSPToolRequest {}

interface Reference {
  filePath: string;
  line: number;
  column: number;
  text: string;
  preview: string;
}

interface FindReferencesSuccess {
  message: string;
  references: Reference[];
}

/**
 * Finds all references to a TypeScript symbol using LSP
 */
async function findReferencesWithLSP(
  request: FindReferencesRequest
): Promise<Result<FindReferencesSuccess, string>> {
  const setupResult = await setupLSPRequest(request);
  if ("error" in setupResult) {
    return err(setupResult.error);
  }
  
  const { setup } = setupResult;
  const { client, fileUri, targetLine, symbolPosition } = setup;
  
  try {
    // Find references
    const locations = await client.findReferences(fileUri, {
      line: targetLine,
      character: symbolPosition,
    });
    
    // Convert LSP locations to our Reference format
    const references: Reference[] = [];
    
    for (const location of locations) {
      const refPath = location.uri.replace("file://", "");
      const refContent = readFileSync(refPath, "utf-8");
      const refLines = refContent.split("\n");
      
      // Get the text at the reference location
      const startLine = location.range.start.line;
      const startCol = location.range.start.character;
      const endCol = location.range.end.character;
      const refLineText = refLines[startLine] || "";
      const text = refLineText.substring(startCol, endCol);
      
      // Create preview with context
      const prevLine = startLine > 0 ? refLines[startLine - 1] : "";
      const nextLine = startLine < refLines.length - 1 ? refLines[startLine + 1] : "";
      const preview = [
        prevLine && `${startLine}: ${prevLine}`,
        `${startLine + 1}: ${refLineText}`,
        nextLine && `${startLine + 2}: ${nextLine}`,
      ].filter(Boolean).join("\n");
      
      references.push({
        filePath: relative(request.root, refPath),
        line: startLine + 1, // Convert to 1-based
        column: startCol + 1, // Convert to 1-based
        text,
        preview,
      });
    }
    
    await client.stop();
    
    return ok({
      message: `Found ${references.length} reference${references.length === 1 ? '' : 's'} to "${request.symbolName}"`,
      references,
    });
  } catch (error) {
    await client.stop().catch(() => {});
    return err(error instanceof Error ? error.message : String(error));
  }
}

export const experimentalFindReferencesTool = {
  name: "experimental_find_references",
  description: "Find all references to a TypeScript/JavaScript symbol across the codebase using LSP",
  inputSchema: {
    type: "object",
    properties: {
      root: {
        type: "string",
        description: "Root directory for resolving relative paths",
      },
      filePath: {
        type: "string",
        description: "File path containing the symbol (relative to root)",
      },
      line: {
        oneOf: [
          { type: "number", description: "Line number (1-based)" },
          { type: "string", description: "String to match in the line" },
        ],
        description: "Line number (1-based) or string to match in the line",
      },
      symbolName: {
        type: "string",
        description: "Name of the symbol to find references for",
      },
    },
    required: ["root", "filePath", "line", "symbolName"],
  },
  handler: async (args: FindReferencesRequest): Promise<McpToolResult> => {
    const result = await findReferencesWithLSP(args);
    if (result.isOk()) {
      const messages = [result.value.message];
      
      if (result.value.references.length > 0) {
        messages.push(
          result.value.references
            .map(ref => `\n${ref.filePath}:${ref.line}:${ref.column}\n${ref.preview}`)
            .join("\n")
        );
      }
      
      return formatMcpResult(true, messages);
    } else {
      return formatMcpResult(false, [`Error: ${result.error}`]);
    }
  },
};