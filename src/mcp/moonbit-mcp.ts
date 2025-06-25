#!/usr/bin/env node
/**
 * MCP server for Moonbit language support.
 * This extends the generic LSP-based MCP server with Moonbit-specific configuration.
 */

import { 
  BaseMcpServer,
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
import { existsSync } from "fs";
import { join } from "path";

// Register all tools with moonbit_ prefix and Moonbit-specific descriptions
const tools: ToolDef<any>[] = [
  // Rename tools with moonbit_ prefix
  { ...listToolsTool, name: "moonbit_list_tools", description: "List all available Moonbit MCP tools with descriptions and categories" },
  { ...lspGetHoverTool, name: "moonbit_get_hover", description: "Get hover information (type signature, documentation) for a Moonbit symbol using LSP" },
  { ...lspFindReferencesTool, name: "moonbit_find_references", description: "Find all references to a Moonbit symbol across the codebase using LSP" },
  { ...lspGetDefinitionsTool, name: "moonbit_get_definitions", description: "Get the definition(s) of a Moonbit symbol using LSP" },
  { ...lspGetDiagnosticsTool, name: "moonbit_get_diagnostics", description: "Get Moonbit diagnostics (errors, warnings) for a file using LSP" },
  { ...lspRenameSymbolTool, name: "moonbit_rename_symbol", description: "Rename a Moonbit symbol across the codebase using Language Server Protocol" },
  { ...lspDeleteSymbolTool, name: "moonbit_delete_symbol", description: "Delete a Moonbit symbol (variable, function, struct, etc.) and optionally all its references using LSP" },
  { ...lspGetDocumentSymbolsTool, name: "moonbit_get_document_symbols", description: "Get all symbols (functions, structs, types, etc.) in a Moonbit document using LSP" },
  { ...lspGetWorkspaceSymbolsTool, name: "moonbit_get_workspace_symbols", description: "Search for symbols (functions, types, etc.) across the entire Moonbit workspace using LSP" },
  { ...lspGetCompletionTool, name: "moonbit_get_completion", description: "Get code completion suggestions at a specific position in a Moonbit file using LSP" },
  { ...lspGetSignatureHelpTool, name: "moonbit_get_signature_help", description: "Get signature help (parameter hints) for function calls in Moonbit using LSP" },
  { ...lspGetCodeActionsTool, name: "moonbit_get_code_actions", description: "Get available code actions (quick fixes, refactorings, etc.) for Moonbit code using LSP" },
  { ...lspFormatDocumentTool, name: "moonbit_format_document", description: "Format an entire Moonbit document using the language server's formatting provider" },
];

/**
 * Find Moonbit LSP server executable
 */
function findMoonbitLSP(): string | null {
  // Check common locations for Moonbit LSP
  const possiblePaths = [
    process.env.MOONBIT_LSP_PATH,
    join(process.env.HOME || "", ".moon/bin/lsp-server.js"),
    "/usr/local/lib/moon/bin/lsp-server.js",
    "moon-lsp", // If it's in PATH
  ].filter(Boolean);

  for (const path of possiblePaths) {
    if (path && (path === "moon-lsp" || existsSync(path))) {
      return path;
    }
  }

  return null;
}

async function main() {
  try {
    // Handle initialization
    const initialized = await handleMcpInit(tools, {
      projectName: "moonbit-mcp",
      toolPrefix: "moonbit",
      globalCommand: "moonbit-mcp@latest",
      envConfig: {
        MOONBIT_LSP_PATH: "${MOONBIT_LSP_PATH}", // Optional override
      },
    });

    if (initialized) {
      const lspPath = findMoonbitLSP();
      console.log(`\n📝 Moonbit MCP Server Configuration`);
      if (lspPath) {
        console.log(`✅ Found Moonbit LSP at: ${lspPath}`);
      } else {
        console.log(`⚠️  Moonbit LSP not found. Please install moon and ensure it's in your PATH.`);
        console.log(`   Installation: https://www.moonbitlang.com/download`);
      }
      process.exit(0);
    }

    const projectRoot = process.env.PROJECT_ROOT || process.cwd();

    // Find or use configured Moonbit LSP
    const lspPath = process.env.MOONBIT_LSP_PATH || findMoonbitLSP();

    if (!lspPath) {
      console.error("Error: Moonbit LSP server not found.");
      console.error("Please install moon or set MOONBIT_LSP_PATH environment variable.");
      process.exit(1);
    }

    // Determine how to run the LSP
    let lspCommand: string;
    let lspArgs: string[];
    
    if (lspPath.endsWith(".js")) {
      // Node.js based LSP
      lspCommand = "node";
      lspArgs = [lspPath];
    } else {
      // Native executable
      lspCommand = lspPath;
      lspArgs = [];
    }

    debug(`Starting Moonbit LSP: ${lspCommand} ${lspArgs.join(" ")}`);

    const lspProcess = spawn(lspCommand, lspArgs, {
      cwd: projectRoot,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        MOON_HOME: process.env.MOON_HOME || join(process.env.HOME || "", ".moon"),
      },
    });

    lspProcess.stderr.on("data", (data) => {
      debug(`[moonbit-lsp stderr] ${data}`);
    });

    lspProcess.on("error", (error) => {
      debug(`[moonbit-lsp error] ${error.message}`);
      console.error(`Failed to start Moonbit LSP: ${error.message}`);
      process.exit(1);
    });

    // Initialize LSP client with Moonbit language ID
    await initializeLSPClient(projectRoot, lspProcess, "moonbit");

    // Start MCP server
    const server = new BaseMcpServer({
      name: "moonbit-mcp",
      version: "1.0.0"
    });
    
    server.registerTools(tools);

    await server.start();

    debug("Moonbit MCP server started");

    // Handle shutdown
    process.on("SIGINT", async () => {
      debug("Shutting down Moonbit MCP server");
      lspProcess.kill();
      process.exit(0);
    });

  } catch (error) {
    console.error("Failed to start Moonbit MCP server:", error);
    process.exit(1);
  }
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("/moonbit-mcp.js")) {
  main();
}