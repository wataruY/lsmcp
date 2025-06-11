import { createLSPClient } from "./lsp_client.ts";
import { readFileSync } from "fs";
import { resolve } from "path";
import { type Result, ok, err } from "neverthrow";

export interface FindReferencesRequest {
  filePath: string;
  line: number;
  column: number;
}

export interface Reference {
  filePath: string;
  line: number;
  column: number;
  text: string;
  lineText: string;
}

export interface FindReferencesSuccess {
  message: string;
  references: Reference[];
  symbol: {
    name: string;
    kind: string;
  };
}

export async function findReferencesWithLSP(
  projectRoot: string,
  request: FindReferencesRequest
): Promise<Result<FindReferencesSuccess, string>> {
  const client = createLSPClient(projectRoot);

  try {
    // Start LSP server
    await client.start();

    // Read file content
    const absolutePath = resolve(projectRoot, request.filePath);
    const fileContent = readFileSync(absolutePath, "utf-8");
    const fileUri = `file://${absolutePath}`;

    // Open document in LSP
    client.openDocument(fileUri, fileContent);

    // Give LSP server time to process the document
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Find references
    const locations = await client.findReferences(fileUri, {
      line: request.line - 1, // LSP uses 0-based line numbers
      character: request.column - 1, // LSP uses 0-based column numbers
    });

    // Convert LSP locations to our Reference format
    const references: Reference[] = [];

    for (const location of locations) {
      if (!location.uri) {
        continue;
      }
      const refPath = location.uri.replace("file://", "");
      const refContent = readFileSync(refPath, "utf-8");
      const lines = refContent.split("\n");

      // Get the text at the reference location
      const startLine = location.range.start.line;
      const startCol = location.range.start.character;
      const endCol = location.range.end.character;
      const lineText = lines[startLine] || "";
      const text = lineText.substring(startCol, endCol);

      references.push({
        filePath: refPath,
        line: startLine + 1, // Convert back to 1-based
        column: startCol + 1, // Convert back to 1-based
        text,
        lineText: lineText.trim(),
      });
    }

    // Try to get symbol info from the first reference
    const symbolName = references.length > 0 ? references[0].text : "unknown";

    await client.stop();

    return ok({
      message: `Found ${references.length} reference${
        references.length === 1 ? "" : "s"
      } for symbol "${symbolName}"`,
      references,
      symbol: {
        name: symbolName,
        kind: "unknown", // LSP doesn't provide symbol kind in references
      },
    });
  } catch (error) {
    await client.stop().catch(() => {}); // Ensure cleanup
    return err(error instanceof Error ? error.message : String(error));
  }
}
