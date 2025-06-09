#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTool } from "./mcp_server_utils.ts";
import { moveFileTool } from "../tools/move_file";
import { move_directory } from "../tools/move_directory";
import { renameSymbolTool } from "../tools/rename_symbol";
import { deleteSymbolTool } from "../tools/delete_symbol";
import { findReferencesTool } from "../tools/find_references";
import { getDefinitionsTool } from "../tools/get_definitions";
import { getDiagnosticsTool } from "../tools/get_diagnostics";
import { getModuleSymbolsTool } from "../tools/get_module_symbols";
import { getTypeInModuleTool } from "../tools/get_type_in_module";
import { getTypeAtSymbolTool } from "../tools/get_type_at_symbol";
import { getSymbolsInScopeTool } from "../tools/get_symbols_in_scope";
import { getModuleGraphTool } from "../tools/get_module_graph";
import { getRelatedModulesTool } from "../tools/get_related_modules";

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
  findReferencesTool,
  getDefinitionsTool,
  getDiagnosticsTool,
  getModuleSymbolsTool,
  getTypeInModuleTool,
  getTypeAtSymbolTool,
  getSymbolsInScopeTool,
  // WIP: does not work yet correctly
  // getModuleGraphTool,
  // getRelatedModulesTool,
];

for (const tool of tools) {
  registerTool(server, tool);
}

// Start the server
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("TypeScript Refactoring MCP Server running on stdio");
  } catch (error) {
    console.error("Error starting MCP server:", error);
    process.exit(1);
  }
}

main();
