#!/usr/bin/env node
/* eslint-disable no-console */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTool } from "../mcp/mcp_server_utils.ts";
import { lspFindReferencesTool } from "./tools/find_references.ts";
import { lspGetDefinitionsTool } from "./tools/get_definitions.ts";
import { lspGetDiagnosticsTool } from "./tools/get_diagnostics.ts";
import { lspGetHoverTool } from "./tools/get_hover.ts";

const projectRoot = process.env.PROJECT_ROOT || process.cwd();

const server = new McpServer({
  name: "rust",
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
  registerTool(server, tool, projectRoot);
}

// Start the server
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("TypeScript Refactoring MCP Server running on stdio");
    console.error(`Project root: ${projectRoot}`);
  } catch (error) {
    console.error("Error starting MCP server:", error);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
