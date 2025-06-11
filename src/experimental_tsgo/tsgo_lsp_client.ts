import { ChildProcess } from "child_process";
import { createLSPClient, type LSPClientConfig } from "../lsp/index.ts";

/**
 * Create a tsgo-specific LSP client
 * 
 * @param rootPath - The root path of the project
 * @param process - The tsgo LSP server process
 * @returns An LSP client configured for tsgo
 */
export function createTsgoLSPClient(rootPath: string, process: ChildProcess) {
  const lspConfig: LSPClientConfig = {
    rootPath,
    process,
    languageId: "typescript", // tsgo is a TypeScript implementation
    clientName: "tsgo-mcp-lsp-client",
    clientVersion: "0.1.0",
  };

  return createLSPClient(lspConfig);
}