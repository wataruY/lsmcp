/**
 * Common initialization logic for language-specific MCP servers
 */

import { spawn, ChildProcess, execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { 
  BaseMcpServer,
  debug,
  type ToolDef 
} from "./_mcplib.ts";
import { initialize as initializeLSPClient } from "../lsp/lspClient.ts";
import { handleMcpInit } from "./mcpInit.ts";

// Import all LSP tools
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
import { listToolsTool } from "./tools/listTools.ts";

export interface LanguageServerConfig {
  language: string;
  displayName: string;
  icon: string;
  lspCommand?: string;
  lspArgs?: string[];
  findLspExecutable?: () => string | null;
  checkLspInstalled?: () => boolean;
  installInstructions?: string;
  envConfig?: Record<string, string>;
}

/**
 * Get LSP tools with language-specific prefixes and descriptions
 */
export function getLanguageTools(language: string, displayName: string): ToolDef<any>[] {
  const prefix = language + "_";
  
  return [
    { 
      ...listToolsTool, 
      name: prefix + "list_tools", 
      description: `List all available ${displayName} MCP tools with descriptions and categories` 
    },
    { 
      ...lspGetHoverTool, 
      name: prefix + "get_hover", 
      description: `Get hover information (type signature, documentation) for a ${displayName} symbol using LSP` 
    },
    { 
      ...lspFindReferencesTool, 
      name: prefix + "find_references", 
      description: `Find all references to a ${displayName} symbol across the codebase using LSP` 
    },
    { 
      ...lspGetDefinitionsTool, 
      name: prefix + "get_definitions", 
      description: `Get the definition(s) of a ${displayName} symbol using LSP` 
    },
    { 
      ...lspGetDiagnosticsTool, 
      name: prefix + "get_diagnostics", 
      description: `Get ${displayName} diagnostics (errors, warnings) for a file using LSP` 
    },
    { 
      ...lspRenameSymbolTool, 
      name: prefix + "rename_symbol", 
      description: `Rename a ${displayName} symbol across the codebase using Language Server Protocol` 
    },
    { 
      ...lspDeleteSymbolTool, 
      name: prefix + "delete_symbol", 
      description: `Delete a ${displayName} symbol and optionally all its references using LSP` 
    },
    { 
      ...lspGetDocumentSymbolsTool, 
      name: prefix + "get_document_symbols", 
      description: `Get all symbols in a ${displayName} document using LSP` 
    },
    { 
      ...lspGetWorkspaceSymbolsTool, 
      name: prefix + "get_workspace_symbols", 
      description: `Search for symbols across the entire ${displayName} workspace using LSP` 
    },
    { 
      ...lspGetCompletionTool, 
      name: prefix + "get_completion", 
      description: `Get code completion suggestions in a ${displayName} file using LSP` 
    },
    { 
      ...lspGetSignatureHelpTool, 
      name: prefix + "get_signature_help", 
      description: `Get signature help for ${displayName} function calls using LSP` 
    },
    { 
      ...lspGetCodeActionsTool, 
      name: prefix + "get_code_actions", 
      description: `Get available code actions for ${displayName} code using LSP` 
    },
    { 
      ...lspFormatDocumentTool, 
      name: prefix + "format_document", 
      description: `Format a ${displayName} document using the language server's formatting provider` 
    },
  ];
}

/**
 * Language server configurations
 */
export const LANGUAGE_SERVER_CONFIGS: Record<string, LanguageServerConfig> = {
  moonbit: {
    language: "moonbit",
    displayName: "Moonbit",
    icon: "🌙",
    findLspExecutable: () => {
      const home = process.env.HOME || process.env.USERPROFILE || "";
      const lspPath = join(home, ".moon/bin/lsp-server.js");
      return existsSync(lspPath) ? lspPath : null;
    },
    installInstructions: "Install Moonbit from https://www.moonbitlang.com/",
  },
  rust: {
    language: "rust",
    displayName: "Rust",
    icon: "🦀",
    lspCommand: "rust-analyzer",
    lspArgs: [],
    checkLspInstalled: () => {
      try {
        execSync("rust-analyzer --version", { stdio: "pipe" });
        return true;
      } catch {
        return false;
      }
    },
    installInstructions: "Install with: rustup component add rust-analyzer",
  },
};

/**
 * Start LSP server for a specific language configuration
 */
export async function startLanguageServer(
  config: LanguageServerConfig,
  projectRoot: string
): Promise<ChildProcess> {
  let command: string;
  let args: string[] = [];

  // Special handling for finding LSP executable
  if (config.findLspExecutable) {
    const lspPath = config.findLspExecutable();
    if (!lspPath) {
      throw new Error(`${config.displayName} LSP not found. ${config.installInstructions}`);
    }
    
    // Determine how to run it
    if (lspPath.endsWith(".js")) {
      command = "node";
      args = [lspPath];
    } else {
      command = lspPath;
    }
  } else if (config.lspCommand) {
    // Check if installed
    if (config.checkLspInstalled && !config.checkLspInstalled()) {
      throw new Error(`${config.lspCommand} not found. ${config.installInstructions}`);
    }
    
    command = process.env[`${config.language.toUpperCase()}_LSP_PATH`] || config.lspCommand;
    args = config.lspArgs || [];
  } else {
    throw new Error(`No LSP configuration for ${config.language}`);
  }

  debug(`Starting ${config.displayName} LSP: ${command} ${args.join(" ")}`);

  const lspProcess = spawn(command, args, {
    cwd: projectRoot,
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
  });

  lspProcess.stderr.on("data", (data) => {
    debug(`[${config.language}-lsp stderr] ${data}`);
  });

  lspProcess.on("error", (error) => {
    debug(`[${config.language}-lsp error] ${error.message}`);
    throw error;
  });

  return lspProcess;
}

/**
 * Initialize a language-specific MCP server
 */
export async function initializeLanguageMCP(config: LanguageServerConfig) {
  const projectName = `${config.language}-mcp`;
  const tools = getLanguageTools(config.language, config.displayName);
  
  // Handle initialization
  const initialized = await handleMcpInit(tools, {
    projectName,
    toolPrefix: config.language,
    globalCommand: `${projectName}@latest`,
    envConfig: config.envConfig || {},
  });

  if (initialized) {
    console.log(`\n${config.icon} ${config.displayName} MCP Server Configuration`);
    
    // Check if LSP is available
    if (config.findLspExecutable) {
      const lspPath = config.findLspExecutable();
      if (lspPath) {
        console.log(`✅ Found ${config.displayName} LSP at: ${lspPath}`);
      } else {
        console.log(`⚠️  ${config.displayName} LSP not found. ${config.installInstructions}`);
      }
    } else if (config.checkLspInstalled) {
      if (config.checkLspInstalled()) {
        console.log(`✅ ${config.lspCommand} is installed and available`);
      } else {
        console.log(`⚠️  ${config.lspCommand} not found. ${config.installInstructions}`);
      }
    }
    
    process.exit(0);
  }

  const projectRoot = process.env.PROJECT_ROOT || process.cwd();

  // Start LSP server
  const lspProcess = await startLanguageServer(config, projectRoot);

  // Initialize LSP client
  await initializeLSPClient(projectRoot, lspProcess, config.language);

  // Start MCP server
  const server = new BaseMcpServer({
    name: projectName,
    version: "1.0.0"
  });
  
  server.registerTools(tools);

  await server.start();

  debug(`${config.displayName} MCP server started`);

  // Handle shutdown
  process.on("SIGINT", async () => {
    debug(`Shutting down ${config.displayName} MCP server`);
    lspProcess.kill();
    process.exit(0);
  });
}