#!/usr/bin/env node
/**
 * Generic MCP server for LSP-based tools.
 */
/* eslint-disable no-console */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTool } from "./mcpLib.ts";
import { lspGetHoverTool } from "../lsp/tools/lspGetHover.ts";
import { lspFindReferencesTool } from "../lsp/tools/lspFindReferences.ts";
import { lspGetDefinitionsTool } from "../lsp/tools/lspGetDefinitions.ts";
import { lspGetDiagnosticsTool } from "../lsp/tools/lspGetDiagnostics.ts";
import { spawn } from "child_process";
import { initialize as initializeLSPClient } from "../lsp/lspClient.ts";

// Get project root from environment variable or use current directory
const projectRoot = process.env.PROJECT_ROOT || process.cwd();

const server = new McpServer({
  name: "lsp",
  version: "1.0.0",
});

// Register all tools
const tools = [
  lspGetHoverTool,
  lspFindReferencesTool,
  lspGetDefinitionsTool,
  lspGetDiagnosticsTool,
];

for (const tool of tools) {
  // @ts-expect-error - ToolDef is not a ZodObject
  registerTool(server, tool, projectRoot);
}

const LSP_COMMAND = process.env.LSP_COMMAND;

if (!LSP_COMMAND) {
  console.error("Error: LSP_COMMAND environment variable is not set.");
  process.exit(1);
}

const [lspCommand, ...lspArgs] = LSP_COMMAND.split(" ");
const lspProcess = spawn(lspCommand, lspArgs, {
  cwd: projectRoot,
  stdio: ["pipe", "pipe", "pipe"],
});
await initializeLSPClient(projectRoot, lspProcess, "typescript");

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LSP Refactoring MCP Server running on stdio");
  console.error(`Project root: ${projectRoot}`);
  // Initialize LSP client for LSP-based tools
}

await main();
