#!/usr/bin/env node
/**
 * MCP server for Rust language support.
 * This extends the generic LSP-based MCP server with Rust-specific configuration.
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
import { spawn, execSync } from "child_process";
import { initialize as initializeLSPClient } from "../lsp/lspClient.ts";
import { handleMcpInit } from "./mcpInit.ts";
import { listToolsTool } from "./tools/listTools.ts";

// Register all tools with rust_ prefix
const tools: ToolDef<any>[] = [
  // Rename tools with rust_ prefix
  { ...listToolsTool, name: "rust_list_tools" },
  { ...lspGetHoverTool, name: "rust_get_hover" },
  { ...lspFindReferencesTool, name: "rust_find_references" },
  { ...lspGetDefinitionsTool, name: "rust_get_definitions" },
  { ...lspGetDiagnosticsTool, name: "rust_get_diagnostics" },
  { ...lspRenameSymbolTool, name: "rust_rename_symbol" },
  { ...lspDeleteSymbolTool, name: "rust_delete_symbol" },
  { ...lspGetDocumentSymbolsTool, name: "rust_get_document_symbols" },
  { ...lspGetWorkspaceSymbolsTool, name: "rust_get_workspace_symbols" },
  { ...lspGetCompletionTool, name: "rust_get_completion" },
  { ...lspGetSignatureHelpTool, name: "rust_get_signature_help" },
  { ...lspGetCodeActionsTool, name: "rust_get_code_actions" },
  { ...lspFormatDocumentTool, name: "rust_format_document" },
];

/**
 * Check if rust-analyzer is available
 */
function checkRustAnalyzer(): boolean {
  try {
    execSync("rust-analyzer --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  try {
    // Handle initialization
    const initialized = await handleMcpInit(tools, {
      projectName: "rust-mcp",
      toolPrefix: "rust",
      globalCommand: "rust-mcp@latest",
      envConfig: {
        RUST_ANALYZER_PATH: "${RUST_ANALYZER_PATH}", // Optional override
      },
    });

    if (initialized) {
      const hasRustAnalyzer = checkRustAnalyzer();
      console.log(`\n🦀 Rust MCP Server Configuration`);
      if (hasRustAnalyzer) {
        console.log(`✅ rust-analyzer is installed and available`);
      } else {
        console.log(`⚠️  rust-analyzer not found. Please install it:`);
        console.log(`   rustup component add rust-analyzer`);
        console.log(`   or download from: https://rust-analyzer.github.io/`);
      }
      process.exit(0);
    }

    const projectRoot = process.env.PROJECT_ROOT || process.cwd();

    // Use configured path or default to rust-analyzer
    const rustAnalyzerPath = process.env.RUST_ANALYZER_PATH || "rust-analyzer";

    // Check if rust-analyzer is available
    if (!checkRustAnalyzer() && rustAnalyzerPath === "rust-analyzer") {
      console.error("Error: rust-analyzer not found in PATH.");
      console.error("Please install rust-analyzer:");
      console.error("  rustup component add rust-analyzer");
      console.error("Or set RUST_ANALYZER_PATH environment variable.");
      process.exit(1);
    }

    debug(`Starting rust-analyzer: ${rustAnalyzerPath}`);

    const lspProcess = spawn(rustAnalyzerPath, [], {
      cwd: projectRoot,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        // rust-analyzer specific environment variables
        RUST_ANALYZER_CARGO_TARGET_DIR: process.env.RUST_ANALYZER_CARGO_TARGET_DIR || "target",
      },
    });

    lspProcess.stderr.on("data", (data) => {
      debug(`[rust-analyzer stderr] ${data}`);
    });

    lspProcess.on("error", (error) => {
      debug(`[rust-analyzer error] ${error.message}`);
      console.error(`Failed to start rust-analyzer: ${error.message}`);
      process.exit(1);
    });

    // Initialize LSP client with Rust language ID
    await initializeLSPClient(projectRoot, lspProcess, "rust");

    // Start MCP server
    const server = new BaseMcpServer({
      name: "rust-mcp",
      version: "1.0.0"
    });
    
    server.registerTools(tools);

    await server.start();

    debug("Rust MCP server started");

    // Handle shutdown
    process.on("SIGINT", async () => {
      debug("Shutting down Rust MCP server");
      lspProcess.kill();
      process.exit(0);
    });

  } catch (error) {
    console.error("Failed to start Rust MCP server:", error);
    process.exit(1);
  }
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("/rust-mcp.js")) {
  main();
}