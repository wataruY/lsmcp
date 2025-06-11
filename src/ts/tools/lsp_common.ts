import { readFileSync } from "fs";
import { resolve } from "path";
import { spawn } from "child_process";
import { createLSPClient } from "../../lsp/lsp_client.ts";

/**
 * Common request interface for LSP-based tools
 */
export interface LSPToolRequest {
  root: string;
  filePath: string;
  line: number | string;
  symbolName: string;
}

/**
 * Common MCP tool result format
 */
export interface McpToolResult {
  content: { type: "text"; text: string; [x: string]: unknown }[];
  isError?: boolean;
  [x: string]: unknown;
}

/**
 * LSP Client type
 */
export type LSPClient = ReturnType<typeof createLSPClient>;

/**
 * Parses a line number from either a number or a string match
 * @param lines Array of file lines
 * @param line Line number (1-based) or string to match
 * @returns 0-based line index or error message
 */
export function parseLineNumber(
  lines: string[],
  line: number | string
): { lineIndex: number } | { error: string } {
  if (typeof line === "string") {
    const lineIndex = lines.findIndex((l) => l.includes(line));
    if (lineIndex === -1) {
      return { error: `Line containing "${line}" not found` };
    }
    return { lineIndex };
  } else {
    return { lineIndex: line - 1 }; // Convert to 0-based
  }
}

/**
 * Finds the position of a symbol within a line
 * @param lineText The text of the line
 * @param symbolName The symbol to find
 * @param symbolIndex Optional index if symbol appears multiple times (0-based)
 * @returns Character index or error message
 */
export function findSymbolInLine(
  lineText: string,
  symbolName: string,
  symbolIndex: number = 0
): { characterIndex: number } | { error: string } {
  let currentIndex = -1;
  let foundCount = 0;

  while (foundCount <= symbolIndex) {
    currentIndex = lineText.indexOf(symbolName, currentIndex + 1);
    if (currentIndex === -1) {
      if (foundCount === 0) {
        return { error: `Symbol "${symbolName}" not found` };
      } else {
        return {
          error: `Symbol "${symbolName}" occurrence ${symbolIndex} not found (only ${foundCount} occurrences)`,
        };
      }
    }
    foundCount++;
  }

  return { characterIndex: currentIndex };
}

/**
 * Finds the first occurrence of target text across all lines
 * @param lines Array of file lines
 * @param target Text to find
 * @returns Line index and character position or error
 */
export function findTargetInFile(
  lines: string[],
  target: string
): { lineIndex: number; characterIndex: number } | { error: string } {
  for (let i = 0; i < lines.length; i++) {
    const charIndex = lines[i].indexOf(target);
    if (charIndex !== -1) {
      return { lineIndex: i, characterIndex: charIndex };
    }
  }
  return { error: `Target text "${target}" not found in file` };
}

/**
 * Common setup for LSP-based tools
 * Opens a document in the LSP client and finds the target position
 */
export interface LSPSetupResult {
  client: LSPClient;
  fileUri: string;
  fileContent: string;
  lines: string[];
  targetLine: number;
  symbolPosition: number;
}

export async function setupLSPRequest(
  request: LSPToolRequest
): Promise<{ setup: LSPSetupResult } | { error: string }> {
  let client: LSPClient | null = null;

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

    // Parse line number
    const lines = fileContent.split("\n");
    const lineResult = parseLineNumber(lines, request.line);
    if ("error" in lineResult) {
      await client?.stop().catch(() => {});
      return { error: `${lineResult.error} in ${request.filePath}` };
    }

    const targetLine = lineResult.lineIndex;

    // Find symbol position in line
    const lineText = lines[targetLine];
    const symbolResult = findSymbolInLine(lineText, request.symbolName);
    if ("error" in symbolResult) {
      await client?.stop().catch(() => {});
      return { error: `${symbolResult.error} on line ${targetLine + 1}` };
    }

    // Open document in LSP
    client.openDocument(fileUri, fileContent);

    // Give LSP server time to process the document
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));

    return {
      setup: {
        client,
        fileUri,
        fileContent,
        lines,
        targetLine,
        symbolPosition: symbolResult.characterIndex,
      },
    };
  } catch (error) {
    await client?.stop().catch(() => {});
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Formats an MCP tool result
 */
export function formatMcpResult(
  success: boolean,
  messages: string[]
): McpToolResult {
  if (success) {
    return {
      content: messages.map((text) => ({ type: "text", text })),
    };
  } else {
    return {
      content: messages.map((text) => ({ type: "text", text })),
      isError: true,
    };
  }
}
