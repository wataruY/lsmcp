#!/usr/bin/env node
/**
 * Generic MCP server for LSP-based tools.
 */

import { 
  BaseMcpServer,
  StdioServerTransport,
  debug,
  type ToolDef 
} from "./_mcplib.ts";
import { lspGetHoverTool } from "../lsp/tools/lspGetHover.ts";
import { lspFindReferencesTool } from "../lsp/tools/lspFindReferences.ts";
import { lspGetDefinitionsTool } from "../lsp/tools/lspGetDefinitions.ts";
import { lspGetDiagnosticsTool } from "../lsp/tools/lspGetDiagnostics.ts";
import { lspRenameSymbolTool } from "../lsp/tools/lspRenameSymbol.ts";
import { lspDeleteSymbolTool } from "../lsp/tools/lspDeleteSymbol.ts";
import { lspGetDocumentSymbolsTool } from "../lsp/tools/lspGetDocumentSymbols.ts";
import { lspGetWorkspaceSymbolsTool } from "../lsp/tools/lspGetWorkspaceSymbols.ts";
import { lspGetCompletionTool } from "../lsp/tools/lspGetCompletion.ts";
import { lspGetSignatureHelpTool } from "../lsp/tools/lspGetSignatureHelp.ts";
import { lspGetCodeActionsTool } from "../lsp/tools/lspGetCodeActions.ts";
import { lspFormatDocumentTool } from "../lsp/tools/lspFormatDocument.ts";
import { spawn } from "child_process";
import { initialize as initializeLSPClient } from "../lsp/lspClient.ts";
import { handleMcpInit } from "./mcpInit.ts";
import { listToolsTool } from "./tools/listTools.ts";

// Register all tools
const tools: ToolDef<any>[] = [
  listToolsTool, // Help tool to list all available tools
  lspGetHoverTool,
  lspFindReferencesTool,
  lspGetDefinitionsTool,
  lspGetDiagnosticsTool,
  lspRenameSymbolTool,
  lspDeleteSymbolTool,
  lspGetDocumentSymbolsTool,
  lspGetWorkspaceSymbolsTool,
  lspGetCompletionTool,
  lspGetSignatureHelpTool,
  lspGetCodeActionsTool,
  lspFormatDocumentTool,
];

async function main() {
  try {
    // Handle initialization
    const initialized = await handleMcpInit(tools, {
      projectName: "lsp-mcp",
      toolPrefix: "lsp",
      globalCommand: "lsp-mcp@latest",
      envConfig: {
        LSP_COMMAND: "${LSP_COMMAND}" // Placeholder for user configuration
      },
    });

    if (initialized) {
      console.log(
        `\n⚠️  Important: Set the LSP_COMMAND environment variable in .mcp.json`
      );
      console.log(
        `   Example: "LSP_COMMAND": "typescript-language-server --stdio"`
      );
      process.exit(0);
    }

    const projectRoot = process.env.PROJECT_ROOT || process.cwd();

    // Start MCP server with LSP
    const LSP_COMMAND = process.env.LSP_COMMAND;

    if (!LSP_COMMAND) {
      // These are actual errors, not debug messages, so we keep console.error
      console.error("Error: LSP_COMMAND environment variable is not set.");
      console.error("Example: LSP_COMMAND=\"typescript-language-server --stdio\" node dist/lsp-mcp.js");
      process.exit(1);
    }

    const server = new BaseMcpServer({
      name: "lsp",
      version: "1.0.0",
      description: "Generic LSP-based tools for MCP",
      capabilities: {
        tools: true,
      },
    });
    
    server.setDefaultRoot(projectRoot);
    server.registerTools(tools);

    // Initialize LSP client
    const [lspCommand, ...lspArgs] = LSP_COMMAND.split(" ");
    const lspProcess = spawn(lspCommand, lspArgs, {
      cwd: projectRoot,
      stdio: ["pipe", "pipe", "pipe"],
    });
    
    await initializeLSPClient(projectRoot, lspProcess, "typescript");
    debug(`Initialized LSP client with command: ${LSP_COMMAND}`);

    // Connect transport and start server
    const transport = new StdioServerTransport();
    await server.getServer().connect(transport);
    
    debug("LSP Refactoring MCP Server running on stdio");
    debug(`Project root: ${projectRoot}`);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});