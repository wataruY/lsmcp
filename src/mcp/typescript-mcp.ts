#!/usr/bin/env node
/* eslint-disable no-console */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTool } from "./mcp_server_utils.ts";
import { moveFileTool } from "../ts/tools/ts_move_file.ts";
import { move_directory } from "../ts/tools/ts_move_directory.ts";
import { renameSymbolTool } from "../ts/tools/ts_rename_symbol.ts";
import { deleteSymbolTool } from "../ts/tools/ts_delete_symbol.ts";
import { findReferencesTool } from "../ts/tools/ts_find_references.ts";
import { getDefinitionsTool } from "../ts/tools/ts_get_definitions.ts";
import { getDiagnosticsTool } from "../ts/tools/ts_get_diagnostics.ts";
import { getModuleSymbolsTool } from "../ts/tools/ts_get_module_symbols.ts";
import { getTypeInModuleTool } from "../ts/tools/ts_get_type_in_module.ts";
import { getTypeAtSymbolTool } from "../ts/tools/ts_get_type_at_symbol.ts";
import { getSymbolsInScopeTool } from "../ts/tools/ts_get_symbols_in_scope.ts";
import { lspGetHoverTool } from "../lsp/tools/lsp_get_hover.ts";
import { lspFindReferencesTool } from "../lsp/tools/lsp_find_references.ts";
import { lspGetDefinitionsTool } from "../lsp/tools/lsp_get_definitions.ts";
import { lspGetDiagnosticsTool } from "../lsp/tools/lsp_get_diagnostics.ts";
import * as fs from "node:fs";
import * as path from "node:path";
import { parseArgs } from "node:util";
import { spawn } from "child_process";
import { initialize as initializeLSPClient } from "../lsp/lsp_client.ts";

// Get project root from environment variable or use current directory
const projectRoot = process.env.PROJECT_ROOT || process.cwd();

const USE_TSGO: boolean = process.env.TSGO != null;

const server = new McpServer({
  name: "typescript",
  version: "1.0.0",
});

// Register all tools
const tools = [
  moveFileTool,
  move_directory,
  renameSymbolTool,
  deleteSymbolTool,
  getModuleSymbolsTool,
  getTypeInModuleTool,
  getTypeAtSymbolTool,
  getSymbolsInScopeTool,
  // WIP: does not work yet correctly
  // getModuleGraphTool,
  // getRelatedModulesTool,

  ...(USE_TSGO
    ? [
        lspGetHoverTool,
        lspFindReferencesTool,
        lspGetDefinitionsTool,
        lspGetDiagnosticsTool,
      ]
    : [findReferencesTool, getDefinitionsTool, getDiagnosticsTool]),
];

for (const tool of tools) {
  registerTool(server, tool, projectRoot);
}

if (USE_TSGO) {
  // Use tsgo LSP
  const tsgoProcess = spawn(
    "npx",
    ["@typescript/native-preview", "--lsp", "-stdio"],
    {
      cwd: projectRoot,
      stdio: ["pipe", "pipe", "pipe"],
    }
  );
  await initializeLSPClient(projectRoot, tsgoProcess, "typescript");
  console.error("[tsgo] Initialized tsgo LSP client");
}

interface McpConfig {
  mcpServers?: Record<
    string,
    {
      command: string;
      args: string[];
    }
  >;
}

interface ClaudeSettings {
  permissions?: {
    allow?: string[];
    deny?: string[];
  };
}

function readJsonFile(filePath: string): unknown {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  try {
    return JSON.parse(content);
  } catch (e) {
    console.error(`Error parsing ${filePath}:`, e);
    process.exit(1);
  }
}

function writeJsonFile(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function mergePermissions(
  existing: string[] = [],
  additions: string[] = []
): string[] {
  return [...existing, ...additions].filter(
    (v, i, arr) => arr.indexOf(v) === i
  );
}

function getTypescriptPermissions(): string[] {
  const basePermissions = [
    "mcp__typescript__move_file",
    "mcp__typescript__move_directory",
    "mcp__typescript__rename_symbol",
    "mcp__typescript__delete_symbol",
    "mcp__typescript__find_references",
    "mcp__typescript__get_definitions",
    "mcp__typescript__get_diagnostics",
    "mcp__typescript__get_module_symbols",
    "mcp__typescript__get_type_in_module",
    "mcp__typescript__get_type_at_symbol",
    "mcp__typescript__get_symbols_in_scope",
  ];

  // Only include experimental permissions if enabled
  if (USE_TSGO) {
    basePermissions.push(
      "mcp__typescript__lsp_get_hover",
      "mcp__typescript__lsp_find_references",
      "mcp__typescript__lsp_get_definitions",
      "mcp__typescript__lsp_get_diagnostics"
    );
  } else {
    basePermissions.push(
      "mcp__typescript__find_references",
      "mcp__typescript__get_definitions",
      "mcp__typescript__get_diagnostics"
    );
  }

  return basePermissions;
}

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
        const packageContent = fs.readFileSync(packageJsonPath, "utf-8");
        const packageJson = JSON.parse(packageContent) as {
          name?: string;
          version?: string;
        };
        if (packageJson.name === "typescript" && packageJson.version) {
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

function getTypescriptMcpConfig(isGlobal: boolean = false): McpConfig {
  if (isGlobal) {
    return {
      mcpServers: {
        typescript: {
          command: "npx",
          args: ["-y", "typescript-mcp@latest"],
        },
      },
    };
  }
  return {
    mcpServers: {
      typescript: {
        command: "npx",
        args: ["typescript-mcp"],
      },
    },
  };
}

function updateMcpConfig(
  mcpConfigPath: string,
  isGlobal: boolean = false
): void {
  const result = readJsonFile(mcpConfigPath);
  const existingConfig = result ? (result as McpConfig) : {};
  const typescriptConfig = getTypescriptMcpConfig(isGlobal);

  const mergedConfig: McpConfig = {
    ...existingConfig,
    mcpServers: {
      ...existingConfig.mcpServers,
      ...typescriptConfig.mcpServers,
    },
  };

  writeJsonFile(mcpConfigPath, mergedConfig);
}

function updateClaudeSettings(
  claudeDir: string,
  claudeSettingsPath: string
): void {
  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }

  const result = readJsonFile(claudeSettingsPath);
  const existingSettings = result ? (result as ClaudeSettings) : {};
  const mergedSettings: ClaudeSettings = {
    ...existingSettings,
    permissions: {
      allow: mergePermissions(
        existingSettings.permissions?.allow,
        getTypescriptPermissions()
      ),
      deny: existingSettings.permissions?.deny || [],
    },
  };

  writeJsonFile(claudeSettingsPath, mergedSettings);
}

// Handle initialization
function handleInit(target: string): void {
  const validTargets = ["claude", "global"];

  // Default to claude (local) if not specified
  if (!target || target === "claude") {
    target = "claude";
  } else if (!validTargets.includes(target)) {
    console.error(
      `Unknown init target: ${target}. Supported: ${validTargets.join(", ")}`
    );
    process.exit(1);
  }

  const cwd = process.cwd();
  const mcpConfigPath = path.join(cwd, ".mcp.json");
  const claudeDir = path.join(cwd, ".claude");
  const claudeSettingsPath = path.join(claudeDir, "settings.json");
  const isGlobal = target === "global";

  try {
    updateMcpConfig(mcpConfigPath, isGlobal);
    updateClaudeSettings(claudeDir, claudeSettingsPath);

    console.log(
      `✓ Created/updated .mcp.json with typescript-mcp configuration`
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
      console.log(`\nInstall typescript-mcp as a dev dependency:`);
      console.log(`  npm install --save-dev typescript-mcp`);
      console.log(`  # or`);
      console.log(`  pnpm add -D typescript-mcp`);
    }
  } catch (error) {
    console.error("Error during initialization:", error);
    process.exit(1);
  }
}

// Start the server
async function main() {
  // Parse command line arguments
  const { values } = parseArgs({
    options: {
      init: {
        type: "string",
      },
    },
    strict: true,
    allowPositionals: false,
  });

  // Handle initialization if requested
  if (values.init) {
    handleInit(values.init);
    process.exit(0);
  }

  // Start the MCP server
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("TypeScript Refactoring MCP Server running on stdio");
    console.error(`Project root: ${projectRoot}`);

    // Initialize LSP client for LSP-based tools when USE_TSGO is enabled
    // Display TypeScript information
    const tsInfo = getTypescriptInfo();
    if (tsInfo) {
      console.error(
        `Detected typescript path: ${tsInfo.path} version: ${tsInfo.version}`
      );
    } else {
      console.error("Warning: TypeScript not detected in current project");
    }
  } catch (error) {
    console.error("Error starting MCP server:", error);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
