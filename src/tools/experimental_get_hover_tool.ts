import { type Result, ok, err } from "neverthrow";
import { LSPClient } from "../_experimental/lsp_client.ts";
import { readFileSync } from "fs";
import { resolve } from "path";

interface GetHoverRequest {
  root: string;
  filePath: string;
  line: number | string;
  symbolName: string;
}

// LSP Hover response types
interface MarkupContent {
  kind: "plaintext" | "markdown";
  value: string;
}

type MarkedString = string | { language: string; value: string };

interface HoverResult {
  contents: MarkedString | MarkedString[] | MarkupContent;
  range?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

interface GetHoverSuccess {
  message: string;
  hover: {
    contents: string;
    range?: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  } | null;
}

async function getHover(
  request: GetHoverRequest
): Promise<Result<GetHoverSuccess, string>> {
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
    
    // Get hover info
    const result = await client.getHover(fileUri, {
      line: targetLine,
      character: symbolIndex,
    }) as HoverResult | null;
    
    await client.stop();
    
    if (!result) {
      return ok({
        message: `No hover information available for "${request.symbolName}" at ${request.filePath}:${targetLine + 1}:${symbolIndex + 1}`,
        hover: null,
      });
    }
    
    // Format hover contents
    let formattedContents = "";
    if (typeof result.contents === "string") {
      formattedContents = result.contents;
    } else if (Array.isArray(result.contents)) {
      formattedContents = result.contents
        .map((content: MarkedString) => {
          if (typeof content === "string") {
            return content;
          } else {
            return content.value;
          }
        })
        .join("\n");
    } else if (result.contents && typeof result.contents === "object" && "value" in result.contents) {
      formattedContents = (result.contents as MarkupContent).value;
    }
    
    // Format range if available
    let range = undefined;
    if (result.range) {
      range = {
        start: {
          line: result.range.start.line + 1, // Convert to 1-based
          character: result.range.start.character + 1,
        },
        end: {
          line: result.range.end.line + 1,
          character: result.range.end.character + 1,
        },
      };
    }
    
    return ok({
      message: `Hover information for "${request.symbolName}" at ${request.filePath}:${targetLine + 1}:${symbolIndex + 1}`,
      hover: {
        contents: formattedContents,
        range,
      },
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

export const experimentalGetHoverTool = {
  name: "experimental_get_hover",
  description: "Get hover information (type signature, documentation) for a TypeScript symbol using LSP",
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
        description: "Name of the symbol to get hover information for",
      },
    },
    required: ["root", "filePath", "line", "symbolName"],
  },
  handler: async (args: GetHoverRequest): Promise<McpToolResult> => {
    const result = await getHover(args);
    if (result.isOk()) {
      return {
        content: [
          {
            type: "text",
            text: result.value.message,
          },
          ...(result.value.hover
            ? [
                {
                  type: "text" as const,
                  text: result.value.hover.contents,
                },
              ]
            : []),
        ],
      };
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