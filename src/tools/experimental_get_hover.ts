import { z } from "zod";
import { type Result, ok, err } from "neverthrow";
import { setupLSPRequest, findTargetInFile } from "./lsp_common.ts";
import type { ToolDef } from "../mcp/types.ts";
import { readFileSync } from "fs";
import { resolve } from "path";
import { spawn } from "child_process";
import { createLSPClient } from "../lsp/lsp_client.ts";

/**
 * No-op function for catch handlers
 */
function noop(): void {
  // Intentionally empty
}

const schema = z.object({
  root: z.string().describe("Root directory for resolving relative paths"),
  filePath: z
    .string()
    .describe("File path containing the symbol (relative to root)"),
  line: z
    .union([z.number(), z.string()])
    .describe("Line number (1-based) or string to match in the line")
    .optional(),
  target: z
    .string()
    .describe("Text to find and get hover information for"),
});

type GetHoverRequest = z.infer<typeof schema>;

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
 * Helper to handle hover request when line is not provided
 */
async function getHoverWithoutLine(
  request: GetHoverRequest
): Promise<Result<GetHoverSuccess, string>> {
  let client: ReturnType<typeof createLSPClient> | null = null;
  
  try {
    // Start TypeScript Language Server
    const process = spawn("npx", ["typescript-language-server", "--stdio"], {
      cwd: request.root,
      stdio: ["pipe", "pipe", "pipe"],
    });
    
    // Create client with process
    client = createLSPClient({ rootPath: request.root, process });
    
    // Start LSP server
    await client.start();
    
    // Read file content
    const absolutePath = resolve(request.root, request.filePath);
    const fileContent = readFileSync(absolutePath, "utf-8");
    const fileUri = `file://${absolutePath}`;
    const lines = fileContent.split("\n");
    
    // Find target text in file
    const targetResult = findTargetInFile(lines, request.target);
    if ("error" in targetResult) {
      await client?.stop().catch(noop);
      return err(`${targetResult.error} in ${request.filePath}`);
    }
    
    const { lineIndex: targetLine, characterIndex: symbolPosition } = targetResult;
    
    // Open document in LSP
    client.openDocument(fileUri, fileContent);
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    
    // Get hover info
    const result = (await client.getHover(fileUri, {
      line: targetLine,
      character: symbolPosition,
    })) as HoverResult | null;
    
    await client?.stop();
    
    return formatHoverResult(result, request, targetLine, symbolPosition);
  } catch (error) {
    await client?.stop().catch(noop);
    return err(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Format hover result into GetHoverSuccess
 */
function formatHoverResult(
  result: HoverResult | null,
  request: GetHoverRequest,
  targetLine: number,
  symbolPosition: number
): Result<GetHoverSuccess, string> {
  if (!result) {
    return ok({
      message: `No hover information available for "${
        request.target
      }" at ${request.filePath}:${targetLine + 1}:${symbolPosition + 1}`,
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
        line: result.range.start.line + 1,
        character: result.range.start.character + 1,
      },
      end: {
        line: result.range.end.line + 1,
        character: result.range.end.character + 1,
      },
    };
  }
  
  return ok({
    message: `Hover information for "${request.target}" at ${
      request.filePath
    }:${targetLine + 1}:${symbolPosition + 1}`,
    hover: {
      contents: formattedContents,
      range,
    },
  });
}

/**
 * Gets hover information for a TypeScript symbol using LSP
 */
async function getHover(
  request: GetHoverRequest
): Promise<Result<GetHoverSuccess, string>> {
  // If line is not provided, we need to find the target text
  if (request.line === undefined) {
    return getHoverWithoutLine(request);
  }
  
  // Convert target to LSPToolRequest format
  const lspRequest = {
    root: request.root,
    filePath: request.filePath,
    line: request.line,
    symbolName: request.target,
  };
  
  const setupResult = await setupLSPRequest(lspRequest);
  if ("error" in setupResult) {
    return err(setupResult.error);
  }

  const { setup } = setupResult;
  const { client, fileUri, targetLine, symbolPosition } = setup;

  try {
    // Get hover info
    const result = (await client.getHover(fileUri, {
      line: targetLine,
      character: symbolPosition,
    })) as HoverResult | null;

    await client?.stop();

    return formatHoverResult(result, request, targetLine, symbolPosition);
  } catch (error) {
    await client?.stop().catch(noop);
    return err(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Formats hover contents from various LSP formats to a string
 */
function formatHoverContents(
  contents: MarkedString | MarkedString[] | MarkupContent
): string {
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
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  } else if (typeof contents === "object" && contents && "value" in contents) {
    return (contents as MarkupContent).value;
  }
  return "";
}

export const experimentalGetHoverTool: ToolDef<typeof schema> = {
  name: "experimental_get_hover",
  description:
    "Get hover information (type signature, documentation) for a TypeScript symbol using LSP",
  schema,
  handler: async (args) => {
    const result = await getHover(args);
    if (result.isOk()) {
      const messages = [result.value.message];
      if (result.value.hover) {
        messages.push(result.value.hover.contents);
      }
      return messages.join("\n\n");
    } else {
      throw new Error(result.error);
    }
  },
};
