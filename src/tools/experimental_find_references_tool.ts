import { type Result, ok, err } from "neverthrow";
import { LSPClient } from "../_experimental/lsp_client.ts";
import { readFileSync } from "fs";
import { resolve, relative } from "path";

interface FindReferencesRequest {
  root: string;
  filePath: string;
  line: number | string;
  symbolName: string;
}

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

async function findReferencesWithLSP(
  request: FindReferencesRequest
): Promise<Result<FindReferencesSuccess, string>> {
  const client = new LSPClient(request.root);
  
  try {
    // Start LSP server
    await client.start();
    
    // Read file content
    const absolutePath = resolve(request.root, request.filePath);
    const fileContent = readFileSync(absolutePath, "utf-8");
    const fileUri = `file://${absolutePath}`;
    
    // Parse line number
    const lines = fileContent.split("\n");
    let targetLine: number;
    
    if (typeof request.line === "string") {
      // Find line containing the string
      const lineIndex = lines.findIndex(line => line.includes(request.line as string));
      if (lineIndex === -1) {
        await client.stop().catch(() => {});
        return err(`Line containing "${request.line}" not found in ${request.filePath}`);
      }
      targetLine = lineIndex;
    } else {
      targetLine = request.line - 1; // Convert to 0-based
    }
    
    // Find symbol position in line
    const lineText = lines[targetLine];
    const symbolIndex = lineText.indexOf(request.symbolName);
    if (symbolIndex === -1) {
      await client.stop().catch(() => {});
      return err(`Symbol "${request.symbolName}" not found on line ${targetLine + 1}`);
    }
    
    // Open document in LSP
    await client.openDocument(fileUri, fileContent);
    
    // Give LSP server time to process the document
    await new Promise<void>(resolve => setTimeout(resolve, 1000));
    
    // Find references
    const locations = await client.findReferences(fileUri, {
      line: targetLine,
      character: symbolIndex,
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

interface McpToolResult {
  content: { type: "text"; text: string; [x: string]: unknown }[];
  isError?: boolean;
  [x: string]: unknown;
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
      const content: { type: "text"; text: string }[] = [
        {
          type: "text",
          text: result.value.message,
        },
      ];
      
      if (result.value.references.length > 0) {
        content.push({
          type: "text",
          text: result.value.references
            .map(ref => `\n${ref.filePath}:${ref.line}:${ref.column}\n${ref.preview}`)
            .join("\n"),
        });
      }
      
      return { content };
    } else {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${result.error}`,
          },
        ],
        isError: true,
      };
    }
  },
};