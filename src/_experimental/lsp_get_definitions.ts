import { LSPClient } from "./lsp_client.ts";
import { readFileSync } from "fs";
import { resolve } from "path";
import { type Result, ok, err } from "neverthrow";

export interface GetDefinitionsRequest {
  filePath: string;
  line: number;
  column: number;
}

export interface Definition {
  filePath: string;
  line: number;
  column: number;
  text: string;
  lineText: string;
  kind: string;
}

export interface GetDefinitionsSuccess {
  message: string;
  definitions: Definition[];
  symbol: {
    name: string;
    kind: string;
  };
}

export async function getDefinitionsWithLSP(
  projectRoot: string,
  request: GetDefinitionsRequest
): Promise<Result<GetDefinitionsSuccess, string>> {
  const client = new LSPClient(projectRoot);
  
  try {
    // Start LSP server
    await client.start();
    
    // Read file content
    const absolutePath = resolve(projectRoot, request.filePath);
    const fileContent = readFileSync(absolutePath, "utf-8");
    const fileUri = `file://${absolutePath}`;
    
    // Open document in LSP
    await client.openDocument(fileUri, fileContent);
    
    // Give LSP server time to process the document
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get definition
    const result = await client.getDefinition(fileUri, {
      line: request.line - 1, // LSP uses 0-based line numbers
      character: request.column - 1, // LSP uses 0-based column numbers
    });
    
    // Normalize result to array
    const locations = Array.isArray(result) ? result : [result].filter(Boolean);
    
    // Convert LSP locations to our Definition format
    const definitions: Definition[] = [];
    
    for (const location of locations) {
      const defPath = location.uri.replace("file://", "");
      const defContent = readFileSync(defPath, "utf-8");
      const lines = defContent.split("\n");
      
      // Get the text at the definition location
      const startLine = location.range.start.line;
      const startCol = location.range.start.character;
      const lineText = lines[startLine] || "";
      
      // Try to extract the symbol text from the line
      let text = "";
      let endCol = startCol;
      
      // Simple heuristic to find identifier boundaries
      const identifierPattern = /[a-zA-Z_$][a-zA-Z0-9_$]*/g;
      let match;
      while ((match = identifierPattern.exec(lineText)) !== null) {
        if (match.index <= startCol && startCol < match.index + match[0].length) {
          text = match[0];
          endCol = match.index + match[0].length;
          break;
        }
      }
      
      definitions.push({
        filePath: defPath,
        line: startLine + 1, // Convert back to 1-based
        column: startCol + 1, // Convert back to 1-based
        text: text || lineText.substring(startCol, Math.min(startCol + 20, lineText.length)),
        lineText: lineText.trim(),
        kind: "unknown", // LSP doesn't provide symbol kind in definition response
      });
    }
    
    // Try to get symbol info
    const symbolName = definitions.length > 0 ? definitions[0].text : "unknown";
    
    await client.stop();
    
    return ok({
      message: `Found ${definitions.length} definition${definitions.length === 1 ? '' : 's'} for symbol "${symbolName}"`,
      definitions,
      symbol: {
        name: symbolName,
        kind: "unknown",
      },
    });
  } catch (error) {
    await client.stop().catch(() => {}); // Ensure cleanup
    return err(error instanceof Error ? error.message : String(error));
  }
}