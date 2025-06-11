import { type Result, ok, err } from "neverthrow";
import { LSPClient } from "../_experimental/lsp_client.ts";
import { readFileSync } from "fs";
import { resolve, relative } from "path";

interface GetDefinitionsRequest {
  root: string;
  filePath: string;
  line: number | string;
  symbolName: string;
  before?: number;
  after?: number;
}

interface Definition {
  filePath: string;
  line: number;
  column: number;
  symbolName: string;
  preview: string;
}

interface GetDefinitionsSuccess {
  message: string;
  definitions: Definition[];
}

// LSP definition/location types
interface Location {
  uri: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

type DefinitionResult = Location | Location[] | null;

async function getDefinitionsWithLSP(
  request: GetDefinitionsRequest
): Promise<Result<GetDefinitionsSuccess, string>> {
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
    
    // Get definition
    const result = await client.getDefinition(fileUri, {
      line: targetLine,
      character: symbolIndex,
    }) as DefinitionResult;
    
    // Normalize result to array
    const locations = result ? (Array.isArray(result) ? result : [result]) : [];
    
    // Convert LSP locations to our Definition format
    const definitions: Definition[] = [];
    const contextBefore = request.before || 2;
    const contextAfter = request.after || 2;
    
    for (const location of locations) {
      const defPath = location.uri.replace("file://", "");
      const defContent = readFileSync(defPath, "utf-8");
      const defLines = defContent.split("\n");
      
      // Get the text at the definition location
      const startLine = location.range.start.line;
      const startCol = location.range.start.character;
      const defLineText = defLines[startLine] || "";
      
      // Try to extract the symbol text from the line
      let symbolName = "";
      
      // Simple heuristic to find identifier boundaries
      const identifierPattern = /[a-zA-Z_$][a-zA-Z0-9_$]*/g;
      let match;
      while ((match = identifierPattern.exec(defLineText)) !== null) {
        if (match.index <= startCol && startCol < match.index + match[0].length) {
          symbolName = match[0];
          break;
        }
      }
      
      // If no symbol found, use the requested symbol name
      if (!symbolName) {
        symbolName = request.symbolName;
      }
      
      // Create preview with context
      const previewLines: string[] = [];
      for (let i = Math.max(0, startLine - contextBefore); i <= Math.min(defLines.length - 1, startLine + contextAfter); i++) {
        previewLines.push(`${i + 1}: ${defLines[i]}`);
      }
      const preview = previewLines.join("\n");
      
      definitions.push({
        filePath: relative(request.root, defPath),
        line: startLine + 1, // Convert to 1-based
        column: startCol + 1, // Convert to 1-based
        symbolName,
        preview,
      });
    }
    
    await client.stop();
    
    return ok({
      message: `Found ${definitions.length} definition${definitions.length === 1 ? '' : 's'} for "${request.symbolName}"`,
      definitions,
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

export const experimentalGetDefinitionsTool = {
  name: "experimental_get_definitions",
  description: "Get the definition(s) of a TypeScript symbol using LSP",
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
        description: "Name of the symbol to get definitions for",
      },
      before: {
        type: "number",
        description: "Number of lines to show before the definition",
      },
      after: {
        type: "number",
        description: "Number of lines to show after the definition",
      },
    },
    required: ["root", "filePath", "line", "symbolName"],
  },
  handler: async (args: GetDefinitionsRequest): Promise<McpToolResult> => {
    const result = await getDefinitionsWithLSP(args);
    if (result.isOk()) {
      const content: { type: "text"; text: string }[] = [
        {
          type: "text",
          text: result.value.message,
        },
      ];
      
      if (result.value.definitions.length > 0) {
        for (const def of result.value.definitions) {
          content.push({
            type: "text",
            text: `\n${def.filePath}:${def.line}:${def.column} - ${def.symbolName}\n${def.preview}`,
          });
        }
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