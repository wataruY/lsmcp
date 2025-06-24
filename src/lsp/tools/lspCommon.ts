import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import { pathToFileURL } from "url";
import { getLSPClient } from "../lspClient.ts";
import { resolveLineParameter } from "../../textUtils/resolveLineParameter.ts";

// Common schema shapes for LSP tools
export const filePathShape = {
  root: z.string().describe("Root directory for resolving relative paths"),
  filePath: z
    .string()
    .describe("File path (relative to root)"),
};

export const lineParameterShape = {
  line: z
    .union([z.number(), z.string()])
    .describe("Line number (1-based) or string to match in the line"),
};

export const symbolNameShape = {
  symbolName: z.string().describe("Name of the symbol"),
};

export const characterShape = {
  character: z.number().describe("Character position in the line (0-based)"),
};

// Common file operations
export async function prepareFileContext(
  root: string,
  filePath: string
): Promise<{
  absolutePath: string;
  fileUri: string;
  content: string;
}> {
  // Convert to absolute path
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(root, filePath);

  // Check if file exists
  await fs.access(absolutePath);

  // Convert to file URI
  const fileUri = pathToFileURL(absolutePath).toString();

  // Read the file content
  const content = await fs.readFile(absolutePath, "utf-8");

  return { absolutePath, fileUri, content };
}

// Common LSP client operations
export async function withLSPDocument<T>(
  fileUri: string,
  content: string,
  operation: () => Promise<T>
): Promise<T> {
  const client = getLSPClient();
  if (!client) {
    throw new Error("LSP client not initialized");
  }

  // Open the document in LSP
  client.openDocument(fileUri, content);

  try {
    // Wait a bit for LSP to process the document
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Execute the operation
    return await operation();
  } finally {
    // Close the document
    client.closeDocument(fileUri);
  }
}

// Common line resolution
export function resolveLineOrThrow(
  content: string,
  line: string | number,
  filePath: string
): number {
  const resolveResult = resolveLineParameter(content, line);
  
  if (!resolveResult.success) {
    throw new Error(`${resolveResult.error} in ${filePath}`);
  }
  
  return resolveResult.lineIndex;
}