import { LSPClient } from "./lsp_client.ts";
import { readFileSync } from "fs";
import { resolve } from "path";
import { type Result, ok, err } from "neverthrow";

export interface GetHoverRequest {
  filePath: string;
  line: number;
  column: number;
}

export interface HoverInfo {
  contents: string;
  range?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

export interface GetHoverSuccess {
  message: string;
  hover: HoverInfo | null;
  symbol: {
    name: string;
    kind: string;
  };
}

export async function getHoverWithLSP(
  projectRoot: string,
  request: GetHoverRequest
): Promise<Result<GetHoverSuccess, string>> {
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
    
    // Get hover info
    const result = await client.getHover(fileUri, {
      line: request.line - 1, // LSP uses 0-based line numbers
      character: request.column - 1, // LSP uses 0-based column numbers
    });
    
    if (!result) {
      return ok({
        message: "No hover information available at this position",
        hover: null,
        symbol: {
          name: "unknown",
          kind: "unknown",
        },
      });
    }
    
    // Extract hover content
    let contents = "";
    if (result.contents) {
      if (typeof result.contents === "string") {
        contents = result.contents;
      } else if (Array.isArray(result.contents)) {
        contents = result.contents
          .map((item: any) => {
            if (typeof item === "string") return item;
            if (item.value) return item.value;
            return "";
          })
          .join("\n");
      } else if (result.contents.value) {
        contents = result.contents.value;
      } else if (result.contents.kind === "markdown" && result.contents.value) {
        contents = result.contents.value;
      }
    }
    
    // Try to extract symbol name from hover content
    let symbolName = "unknown";
    const lines = fileContent.split("\n");
    const line = lines[request.line - 1];
    if (line) {
      // Simple heuristic to find identifier at position
      const identifierPattern = /[a-zA-Z_$][a-zA-Z0-9_$]*/g;
      let match;
      while ((match = identifierPattern.exec(line)) !== null) {
        if (match.index <= request.column - 1 && request.column - 1 < match.index + match[0].length) {
          symbolName = match[0];
          break;
        }
      }
    }
    
    const hover: HoverInfo = {
      contents,
    };
    
    if (result.range) {
      hover.range = {
        start: {
          line: result.range.start.line + 1,
          column: result.range.start.character + 1,
        },
        end: {
          line: result.range.end.line + 1,
          column: result.range.end.character + 1,
        },
      };
    }
    
    await client.stop();
    
    return ok({
      message: `Hover information for "${symbolName}"`,
      hover,
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