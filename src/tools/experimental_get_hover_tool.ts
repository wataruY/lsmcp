import { type Result, ok, err } from "neverthrow";
import {
  type LSPToolRequest,
  type McpToolResult,
  setupLSPRequest,
  formatMcpResult,
} from "./lsp_common.ts";

interface GetHoverRequest extends LSPToolRequest {}

/**
 * LSP Hover response types
 */
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

/**
 * Gets hover information for a TypeScript symbol using LSP
 */
async function getHover(
  request: GetHoverRequest
): Promise<Result<GetHoverSuccess, string>> {
  const setupResult = await setupLSPRequest(request);
  if ("error" in setupResult) {
    return err(setupResult.error);
  }
  
  const { setup } = setupResult;
  const { client, fileUri, targetLine, symbolPosition } = setup;
  
  try {
    // Get hover info
    const result = await client.getHover(fileUri, {
      line: targetLine,
      character: symbolPosition,
    }) as HoverResult | null;
    
    await client.stop();
    
    if (!result) {
      return ok({
        message: `No hover information available for "${request.symbolName}" at ${request.filePath}:${targetLine + 1}:${symbolPosition + 1}`,
        hover: null,
      });
    }
    
    // Format hover contents
    const formattedContents = formatHoverContents(result.contents);
    
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
      message: `Hover information for "${request.symbolName}" at ${request.filePath}:${targetLine + 1}:${symbolPosition + 1}`,
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

/**
 * Formats hover contents from various LSP formats to a string
 */
function formatHoverContents(contents: MarkedString | MarkedString[] | MarkupContent): string {
  if (typeof contents === "string") {
    return contents;
  } else if (Array.isArray(contents)) {
    return contents
      .map((content: MarkedString) => {
        if (typeof content === "string") {
          return content;
        } else {
          return content.value;
        }
      })
      .join("\n");
  } else if (typeof contents === "object" && contents && "value" in contents) {
    return (contents as MarkupContent).value;
  }
  return "";
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
      const messages = [result.value.message];
      if (result.value.hover) {
        messages.push(result.value.hover.contents);
      }
      return formatMcpResult(true, messages);
    } else {
      return formatMcpResult(false, [`Error: ${result.error}`]);
    }
  },
};