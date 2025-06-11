import { createLSPClient, type HoverContents } from "./lsp_client.ts";
import { type Hover } from "vscode-languageserver-types";
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

function extractHoverContents(contents: HoverContents): string {
  if (typeof contents === "string") {
    return contents;
  } else if (Array.isArray(contents)) {
    return contents
      .map((item) => {
        if (typeof item === "string") return item;
        if ("value" in item) {
          return String(item.value);
        }
        return "";
      })
      .join("\n");
  } else if ("value" in contents) {
    return String(contents.value);
  }
  return "";
}

export async function getHoverWithLSP(
  projectRoot: string,
  request: GetHoverRequest
): Promise<Result<GetHoverSuccess, string>> {
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

    // At this point, result is guaranteed to be Hover (not null)
    const hoverResult = result as Hover;

    // Extract hover content
    const contents = extractHoverContents(hoverResult.contents);

    // Try to extract symbol name from hover content
    let symbolName = "unknown";
    const lines = fileContent.split("\n");
    const line = lines[request.line - 1];
    if (line) {
      // Simple heuristic to find identifier at position
      const identifierPattern = /[a-zA-Z_$][a-zA-Z0-9_$]*/g;
      let match;
      while ((match = identifierPattern.exec(line)) !== null) {
        if (
          match.index <= request.column - 1 &&
          request.column - 1 < match.index + match[0].length
        ) {
          symbolName = match[0];
          break;
        }
      }
    }

    const hover: HoverInfo = {
      contents,
    };

    if (hoverResult.range) {
      hover.range = {
        start: {
          line: hoverResult.range.start.line + 1,
          column: hoverResult.range.start.character + 1,
        },
        end: {
          line: hoverResult.range.end.line + 1,
          column: hoverResult.range.end.character + 1,
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
