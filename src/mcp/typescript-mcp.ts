#!/usr/bin/env node

import {
  BaseMcpServer,
  StdioServerTransport,
  initializeMcpConfig,
  readJsonFile,
  generatePermissions,
  debug,
  type ToolDef,
} from "./_mcplib.ts";
import { moveFileTool } from "../ts/tools/tsMoveFile.ts";
import { moveDirectoryTool } from "../ts/tools/tsMoveDirectory.ts";
import { renameSymbolTool } from "../ts/tools/tsRenameSymbol.ts";
import { deleteSymbolTool } from "../ts/tools/tsDeleteSymbol.ts";
import { findReferencesTool } from "../ts/tools/tsFindReferences.ts";
import { getDefinitionsTool } from "../ts/tools/tsGetDefinitions.ts";
import { getDiagnosticsTool } from "../ts/tools/tsGetDiagnostics.ts";
import { getModuleSymbolsTool } from "../ts/tools/tsGetModuleSymbols.ts";
import { getTypeInModuleTool } from "../ts/tools/tsGetTypeInModule.ts";
import { getTypeAtSymbolTool } from "../ts/tools/tsGetTypeAtSymbol.ts";
import { getSymbolsInScopeTool } from "../ts/tools/tsGetSymbolsInScope.ts";
import { lspGetHoverTool } from "../lsp/tools/lspGetHover.ts";
import { lspFindReferencesTool } from "../lsp/tools/lspFindReferences.ts";
import { lspGetDefinitionsTool } from "../lsp/tools/lspGetDefinitions.ts";
import { lspGetDiagnosticsTool } from "../lsp/tools/lspGetDiagnostics.ts";
import { lspRenameSymbolTool } from "../lsp/tools/lspRenameSymbol.ts";
import { lspGetDocumentSymbolsTool } from "../lsp/tools/lspGetDocumentSymbols.ts";
import { lspGetCompletionTool } from "../lsp/tools/lspGetCompletion.ts";
import { lspGetSignatureHelpTool } from "../lsp/tools/lspGetSignatureHelp.ts";
import { lspFormatDocumentTool } from "../lsp/tools/lspFormatDocument.ts";
import { lspGetCodeActionsTool } from "../lsp/tools/lspGetCodeActions.ts";
import { listToolsTool } from "./tools/listTools.ts";
import * as fs from "node:fs";
import * as path from "node:path";
import { parseArgs } from "node:util";
import { spawn } from "child_process";
import { initialize as initializeLSPClient } from "../lsp/lspClient.ts";

const USE_TSGO: boolean = process.env.TSGO != null;
const USE_LSP: boolean = process.env.FORCE_LSP === "true" || process.env.LSP_COMMAND != null;

// Define tools based on configuration
const tools: ToolDef<any>[] = [
  listToolsTool, // Help tool to list all available tools
  moveFileTool,
  moveDirectoryTool,
  renameSymbolTool,
  deleteSymbolTool,
  getModuleSymbolsTool,
  getTypeInModuleTool,
  getTypeAtSymbolTool,
  getSymbolsInScopeTool,
  // WIP: does not work yet correctly
  // getModuleGraphTool,
  // getRelatedModulesTool,

  ...((USE_TSGO || USE_LSP)
    ? [
        lspGetHoverTool,
        lspFindReferencesTool,
        lspGetDefinitionsTool,
        lspGetDiagnosticsTool,
        lspRenameSymbolTool,
        lspGetDocumentSymbolsTool,
        lspGetCompletionTool,
        lspGetSignatureHelpTool,
        lspFormatDocumentTool,
        lspGetCodeActionsTool,
      ]
    : [findReferencesTool, getDefinitionsTool, getDiagnosticsTool]),
];

function getTypescriptInfo(): {
  version: string;
  path: string;
} | null {
  try {
    // Resolve TypeScript module path
    const tsPath = import.meta.resolve("typescript");
    const tsUrl = new URL(tsPath);
    const tsFilePath = tsUrl.pathname;

    // Find the package.json for TypeScript
    let currentPath = path.dirname(tsFilePath);
    while (currentPath !== path.dirname(currentPath)) {
      const packageJsonPath = path.join(currentPath, "package.json");
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = readJsonFile(packageJsonPath) as {
          name?: string;
          version?: string;
        } | null;
        if (packageJson?.name === "typescript" && packageJson.version) {
          return {
            version: packageJson.version,
            path: currentPath,
          };
        }
      }
      currentPath = path.dirname(currentPath);
    }
    return null;
  } catch {
    return null;
  }
}

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
      },
      strict: true,
      allowPositionals: false,
    });

    const projectRoot = values["project-root"] || 
                       process.env.PROJECT_ROOT || 
                       process.cwd();

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
            args: ["-y", "lsmcp@latest"],
          }
        : {
            command: "npx",
            args: ["lsmcp"],
          };

      // Generate permissions from tool definitions
      const permissions = generatePermissions("typescript", tools);

      initializeMcpConfig(
        projectRoot,
        "typescript",
        config,
        permissions
      );

      console.log(
        `✓ Created/updated .mcp.json with lsmcp configuration`
      );
      console.log(`✓ Created/updated .claude/settings.json with permissions`);

      // Display TypeScript information
      const tsInfo = getTypescriptInfo();
      if (tsInfo) {
        console.log(`\nTypeScript detected:`);
        console.log(`  Version: ${tsInfo.version}`);
        console.log(`  Path: ${tsInfo.path}`);
      } else {
        console.log(`\n⚠️  TypeScript not found in current project`);
      }

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
      name: "typescript",
      version: "1.0.0",
      description: "TypeScript refactoring and analysis tools for MCP",
      capabilities: {
        tools: true,
      },
    });
    
    server.setDefaultRoot(projectRoot);
    server.registerTools(tools);

    // Initialize LSP if using TSGO or custom LSP
    if (USE_TSGO) {
      const tsgoProcess = spawn(
        "npx",
        ["@typescript/native-preview", "--lsp", "-stdio"],
        {
          cwd: projectRoot,
          stdio: ["pipe", "pipe", "pipe"],
        }
      );
      await initializeLSPClient(projectRoot, tsgoProcess, "typescript");
      debug("[tsgo] Initialized tsgo LSP client");
    } else if (USE_LSP && process.env.LSP_COMMAND) {
      // Parse LSP command
      const parts = process.env.LSP_COMMAND.split(" ");
      const command = parts[0];
      const args = parts.slice(1);
      
      const lspProcess = spawn(command, args, {
        cwd: projectRoot,
        stdio: ["pipe", "pipe", "pipe"],
      });
      await initializeLSPClient(projectRoot, lspProcess, "typescript");
      debug(`[lsp] Initialized custom LSP client: ${process.env.LSP_COMMAND}`);
    }

    // Connect transport and start server
    const transport = new StdioServerTransport();
    await server.getServer().connect(transport);
    
    debug("TypeScript Refactoring MCP Server running on stdio");
    debug(`Project root: ${projectRoot}`);

    // Display TypeScript information
    const tsInfo = getTypescriptInfo();
    if (tsInfo) {
      debug(
        `Detected typescript path: ${tsInfo.path} version: ${tsInfo.version}`
      );
    } else {
      debug("Warning: TypeScript not detected in current project");
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});