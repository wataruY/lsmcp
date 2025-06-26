#!/usr/bin/env node
/**
 * Multi-language MCP server that automatically detects project language
 * and starts the appropriate LSP server.
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
import { initialize as initializeLSPClient } from "../lsp/lspClient.ts";
import { handleMcpInit } from "./mcpInit.ts";
import { createLanguageListTool } from "./tools/listTools.ts";
import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { LANGUAGE_CONFIGS, LanguageInfo } from "../common/languageDetection.ts";
import { startLanguageServerFromInfo } from "./languageServerInit.ts";

// Tools will be dynamically created based on detected language
let tools: ToolDef<any>[] = [];

/**
 * Detect project language based on files in the project root
 */
function detectProjectLanguage(projectRoot: string): LanguageInfo | null {
  // Priority order for detection
  const detectionFiles = [
    { file: "Cargo.toml", language: "rust" },
    { file: "moon.mod.json", language: "moonbit" },
    { file: "tsconfig.json", language: "typescript" },
    { file: "package.json", language: "javascript" }, // Could be TS or JS
    { file: "go.mod", language: "go" },
    { file: "pom.xml", language: "java" },
    { file: "build.gradle", language: "java" },
    { file: "requirements.txt", language: "python" },
    { file: "setup.py", language: "python" },
    { file: "pyproject.toml", language: "python" },
    { file: "CMakeLists.txt", language: "cpp" },
    { file: "Makefile", language: "c" }, // Could be C or C++
  ];

  // Check for specific project files
  for (const { file, language } of detectionFiles) {
    if (existsSync(join(projectRoot, file))) {
      return LANGUAGE_CONFIGS[language] || null;
    }
  }

  // Fallback: check file extensions in the root directory
  const files = readdirSync(projectRoot);
  const extensionCounts: Record<string, number> = {};

  for (const file of files) {
    const match = file.match(/\.([^.]+)$/);
    if (match) {
      const ext = `.${match[1]}`;
      extensionCounts[ext] = (extensionCounts[ext] || 0) + 1;
    }
  }

  // Find the language with the most files
  let maxCount = 0;
  let detectedLanguage: string | null = null;

  for (const [lang, config] of Object.entries(LANGUAGE_CONFIGS)) {
    const count = config.fileExtensions.reduce(
      (sum, ext) => sum + (extensionCounts[ext] || 0),
      0
    );
    if (count > maxCount) {
      maxCount = count;
      detectedLanguage = lang;
    }
  }

  return detectedLanguage ? LANGUAGE_CONFIGS[detectedLanguage] : null;
}


async function main() {
  try {
    // Create temporary tools for initialization check
    const tempTools = [
      createLanguageListTool("language", "Language"),
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
    
    // Handle initialization
    const initialized = await handleMcpInit(tempTools, {
      projectName: "multi-language-mcp",
      toolPrefix: "lsp",
      globalCommand: "multi-language-mcp@latest",
      envConfig: {
        FORCE_LANGUAGE: "${FORCE_LANGUAGE}", // Optional: force a specific language
      },
    });

    if (initialized) {
      console.log(`\n🌍 Multi-Language MCP Server Configuration`);
      console.log(`\nSupported languages:`);
      for (const [lang, config] of Object.entries(LANGUAGE_CONFIGS)) {
        console.log(`  - ${lang}: ${config.fileExtensions.join(", ")}`);
      }
      console.log(`\nThe server will auto-detect the project language.`);
      console.log(`Set FORCE_LANGUAGE to override detection.`);
      process.exit(0);
    }

    const projectRoot = process.env.PROJECT_ROOT || process.cwd();

    // Detect or use forced language
    let languageInfo: LanguageInfo | null = null;
    
    if (process.env.FORCE_LANGUAGE) {
      languageInfo = LANGUAGE_CONFIGS[process.env.FORCE_LANGUAGE];
      if (!languageInfo) {
        console.error(`Error: Unknown language: ${process.env.FORCE_LANGUAGE}`);
        console.error(`Supported languages: ${Object.keys(LANGUAGE_CONFIGS).join(", ")}`);
        process.exit(1);
      }
      debug(`Using forced language: ${process.env.FORCE_LANGUAGE}`);
    } else {
      languageInfo = detectProjectLanguage(projectRoot);
      if (!languageInfo) {
        console.error("Error: Could not detect project language.");
        console.error("Please ensure your project has appropriate config files.");
        console.error("Or set FORCE_LANGUAGE environment variable.");
        process.exit(1);
      }
      debug(`Detected language: ${languageInfo.languageId}`);
    }

    // Start appropriate LSP server
    const lspProcess = await startLanguageServerFromInfo(languageInfo, projectRoot);

    // Initialize LSP client
    await initializeLSPClient(projectRoot, lspProcess, languageInfo.languageId);

    // Create language-specific tools
    const prefix = languageInfo.languageId + "_";
    tools = [
      createLanguageListTool(languageInfo.languageId, languageInfo.languageId),
      { ...lspGetHoverTool, name: prefix + "get_hover", description: `Get hover information for ${languageInfo.languageId} using LSP` },
      { ...lspFindReferencesTool, name: prefix + "find_references", description: `Find all references to a ${languageInfo.languageId} symbol using LSP` },
      { ...lspGetDefinitionsTool, name: prefix + "get_definitions", description: `Get the definition(s) of a ${languageInfo.languageId} symbol using LSP` },
      { ...lspGetDiagnosticsTool, name: prefix + "get_diagnostics", description: `Get ${languageInfo.languageId} diagnostics using LSP` },
      { ...lspRenameSymbolTool, name: prefix + "rename_symbol", description: `Rename a ${languageInfo.languageId} symbol using LSP` },
      { ...lspDeleteSymbolTool, name: prefix + "delete_symbol", description: `Delete a ${languageInfo.languageId} symbol using LSP` },
      { ...lspGetDocumentSymbolsTool, name: prefix + "get_document_symbols", description: `Get all symbols in a ${languageInfo.languageId} document using LSP` },
      { ...lspGetWorkspaceSymbolsTool, name: prefix + "get_workspace_symbols", description: `Search for symbols in the ${languageInfo.languageId} workspace using LSP` },
      { ...lspGetCompletionTool, name: prefix + "get_completion", description: `Get code completion for ${languageInfo.languageId} using LSP` },
      { ...lspGetSignatureHelpTool, name: prefix + "get_signature_help", description: `Get signature help for ${languageInfo.languageId} using LSP` },
      { ...lspGetCodeActionsTool, name: prefix + "get_code_actions", description: `Get code actions for ${languageInfo.languageId} using LSP` },
      { ...lspFormatDocumentTool, name: prefix + "format_document", description: `Format a ${languageInfo.languageId} document using LSP` },
    ];

    // Start MCP server
    const server = new BaseMcpServer({
      name: "multi-language-mcp",
      version: "1.0.0"
    });
    
    server.registerTools(tools);

    await server.start();

    debug(`Multi-language MCP server started for ${languageInfo.languageId}`);

    // Handle shutdown
    process.on("SIGINT", async () => {
      debug("Shutting down Multi-language MCP server");
      lspProcess.kill();
      process.exit(0);
    });

  } catch (error) {
    console.error("Failed to start Multi-language MCP server:", error);
    process.exit(1);
  }
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("/multi-language-mcp.js")) {
  main();
}