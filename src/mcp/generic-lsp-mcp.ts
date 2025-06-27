#!/usr/bin/env node

/**
 * Generic LSP MCP Server
 * 
 * Provides MCP tools for any language with LSP support.
 * This server only includes LSP-based tools, not TypeScript-specific tools.
 */

import {
  BaseMcpServer,
  StdioServerTransport,
  initializeMcpConfig,
  generatePermissions,
  debug,
  type ToolDef,
} from "./_mcplib.ts";
import { lspGetHoverTool } from "../lsp/tools/lspGetHover.ts";
import { lspFindReferencesTool } from "../lsp/tools/lspFindReferences.ts";
import { lspGetDefinitionsTool } from "../lsp/tools/lspGetDefinitions.ts";
import { lspGetDiagnosticsTool } from "../lsp/tools/lspGetDiagnostics.ts";
import { lspRenameSymbolTool } from "../lsp/tools/lspRenameSymbol.ts";
import { lspGetDocumentSymbolsTool } from "../lsp/tools/lspGetDocumentSymbols.ts";
import { lspGetWorkspaceSymbolsTool } from "../lsp/tools/lspGetWorkspaceSymbols.ts";
import { lspGetCompletionTool } from "../lsp/tools/lspGetCompletion.ts";
import { lspGetSignatureHelpTool } from "../lsp/tools/lspGetSignatureHelp.ts";
import { lspFormatDocumentTool } from "../lsp/tools/lspFormatDocument.ts";
import { lspGetCodeActionsTool } from "../lsp/tools/lspGetCodeActions.ts";
import { listToolsTool } from "./tools/listTools.ts";
import { parseArgs } from "node:util";
import { spawn } from "child_process";
import { initialize as initializeLSPClient } from "../lsp/lspClient.ts";
import { getLanguageFromLSPCommand } from "./utils/languageSupport.ts";
import { formatError, ErrorContext } from "./utils/errorHandler.ts";

// Define LSP-only tools
const tools: ToolDef<any>[] = [
  listToolsTool,
  lspGetHoverTool,
  lspFindReferencesTool,
  lspGetDefinitionsTool,
  lspGetDiagnosticsTool,
  lspRenameSymbolTool,
  lspGetDocumentSymbolsTool,
  lspGetWorkspaceSymbolsTool,
  lspGetCompletionTool,
  lspGetSignatureHelpTool,
  lspFormatDocumentTool,
  lspGetCodeActionsTool,
];

async function main() {
  try {
    // Parse command line arguments
    const { values } = parseArgs({
      options: {
        init: {
          type: "string",
        },
        "project-root": {
          type: "string",
        },
        "lsp-command": {
          type: "string",
        },
      },
      strict: true,
      allowPositionals: false,
    });

    // Project root resolution order:
    // 1. Command line argument --project-root
    // 2. Environment variable PROJECT_ROOT (for backward compatibility)
    // 3. Current working directory
    // TODO: When MCP adds client cwd support, prioritize that over env var
    const projectRoot = values["project-root"] || 
                       process.env.PROJECT_ROOT || 
                       process.cwd();

    const lspCommand = values["lsp-command"] || process.env.LSP_COMMAND;
    
    if (!lspCommand) {
      const context: ErrorContext = {
        operation: "LSP server configuration"
      };
      const error = new Error("LSP command is required");
      console.error(formatError(error, context));
      console.error("Usage: generic-lsp-mcp --lsp-command=\"<lsp-server-command>\"");
      console.error("Example: generic-lsp-mcp --lsp-command=\"rust-analyzer\"");
      process.exit(1);
    }

    const detectedLanguage = getLanguageFromLSPCommand(lspCommand);

    // Handle initialization
    if (values.init !== undefined) {
      const target = values.init || "claude";
      const validTargets = ["claude", "global"];
      
      if (!validTargets.includes(target)) {
        console.error(
          `Unknown init target: ${target}. Supported: ${validTargets.join(", ")}`
        );
        process.exit(1);
      }

      const isGlobal = target === "global";
      
      const config = isGlobal
        ? {
            command: "npx",
            args: ["-y", "lsmcp@latest", "--bin", lspCommand],
          }
        : {
            command: "npx",
            args: ["lsmcp", "--bin", lspCommand],
          };

      // Generate permissions from tool definitions
      const permissions = generatePermissions("generic-lsp", tools);

      initializeMcpConfig(
        projectRoot,
        "generic-lsp",
        config,
        permissions
      );

      console.log(
        `✓ Created/updated .mcp.json with generic LSP configuration`
      );
      console.log(`✓ Created/updated .claude/settings.json with permissions`);
      console.log(`\nLSP command: ${lspCommand}`);
      console.log(`Detected language: ${detectedLanguage}`);
      
      if (!isGlobal) {
        console.log(`\nInstall lsmcp as a dev dependency:`);
        console.log(`  npm install --save-dev lsmcp`);
        console.log(`  # or`);
        console.log(`  pnpm add -D lsmcp`);
      }
      
      process.exit(0);
    }

    // Start MCP server
    const server = new BaseMcpServer({
      name: "generic-lsp",
      version: "1.0.0",
      description: `LSP-based tools for ${detectedLanguage} via MCP`,
      capabilities: {
        tools: true,
      },
    });
    
    server.setDefaultRoot(projectRoot);
    server.registerTools(tools);

    // Initialize LSP client
    const parts = lspCommand.split(" ");
    const command = parts[0];
    const args = parts.slice(1);
    
    let lspProcess;
    try {
      lspProcess = spawn(command, args, {
        cwd: projectRoot,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (error) {
      const context: ErrorContext = {
        operation: "LSP server startup",
        language: detectedLanguage,
        details: { command: lspCommand }
      };
      throw new Error(formatError(error, context));
    }
    
    try {
      await initializeLSPClient(projectRoot, lspProcess, detectedLanguage.toLowerCase());
      debug(`[lsp] Initialized LSP client: ${lspCommand}`);
    } catch (error) {
      const context: ErrorContext = {
        operation: "LSP client initialization",
        language: detectedLanguage,
        details: { command: lspCommand }
      };
      throw new Error(formatError(error, context));
    }

    // Connect transport and start server
    const transport = new StdioServerTransport();
    await server.getServer().connect(transport);
    
    debug(`Generic LSP MCP Server running on stdio`);
    debug(`Project root: ${projectRoot}`);
    debug(`LSP command: ${lspCommand}`);
    debug(`Language: ${detectedLanguage}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});