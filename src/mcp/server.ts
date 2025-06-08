#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTool } from "./mcp_server_utils.ts";
import { moveFileTool } from "./tools/move_file.ts";
import { renameSymbolTool } from "./tools/rename_symbol.ts";
import { deleteSymbolTool } from "./tools/delete_symbol.ts";
import { findReferencesTool } from "./tools/find_references.ts";
import { getDefinitionsTool } from "./tools/get_definitions.ts";
import { getDiagnosticsTool } from "./tools/get_diagnostics.ts";
import { getModuleSymbolsTool } from "./tools/get_module_symbols.ts";
import { getTypeSignatureTool } from "./tools/get_type_signature.ts";
import { getModuleGraphTool } from "./tools/get_module_graph.ts";

const server = new McpServer({
  name: "typescript",
  version: "1.0.0",
});

// Register all tools
const tools = [
  moveFileTool,
  renameSymbolTool,
  deleteSymbolTool,
  findReferencesTool,
  getDefinitionsTool,
  getDiagnosticsTool,
  getModuleSymbolsTool,
  getTypeSignatureTool,
  getModuleGraphTool,
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
