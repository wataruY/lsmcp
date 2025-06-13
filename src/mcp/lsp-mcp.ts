#!/usr/bin/env node
/**
 * Generic MCP server for LSP-based tools.
 */

import { 
  BaseMcpServer,
  StdioServerTransport,
  generatePermissions,
  initializeMcpConfig,
  debug,
  type ToolDef 
} from "./_mcplib.ts";
import { lspGetHoverTool } from "../lsp/tools/lspGetHover.ts";
import { lspFindReferencesTool } from "../lsp/tools/lspFindReferences.ts";
import { lspGetDefinitionsTool } from "../lsp/tools/lspGetDefinitions.ts";
import { lspGetDiagnosticsTool } from "../lsp/tools/lspGetDiagnostics.ts";
import { parseArgs } from "node:util";
import { spawn } from "child_process";
import { initialize as initializeLSPClient } from "../lsp/lspClient.ts";

// Register all tools
const tools: ToolDef<any>[] = [
  lspGetHoverTool,
  lspFindReferencesTool,
  lspGetDefinitionsTool,
  lspGetDiagnosticsTool,
];

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
      
      // For LSP server, we need to configure the LSP_COMMAND environment variable
      const config = {
        command: "node",
        args: isGlobal 
          ? ["npx", "-y", "lsp-mcp@latest"]
          : ["dist/lsp-mcp.js"],
        env: {
          LSP_COMMAND: "${LSP_COMMAND}" // Placeholder for user configuration
        }
      };

      // Generate permissions from tool definitions
      const permissions = generatePermissions("lsp", tools);

      initializeMcpConfig(
        projectRoot,
        "lsp",
        config,
        permissions
      );

      console.log(
        `✓ Created/updated .mcp.json with lsp-mcp configuration`
      );
      console.log(`✓ Created/updated .claude/settings.json with permissions`);
      console.log(
        `\n⚠️  Important: Set the LSP_COMMAND environment variable in .mcp.json`
      );
      console.log(
        `   Example: "LSP_COMMAND": "typescript-language-server --stdio"`
      );
      
      process.exit(0);
    }

    // Start MCP server with LSP
    const LSP_COMMAND = process.env.LSP_COMMAND;

    if (!LSP_COMMAND) {
      // These are actual errors, not debug messages, so we keep console.error
      console.error("Error: LSP_COMMAND environment variable is not set.");
      console.error("Example: LSP_COMMAND=\"typescript-language-server --stdio\" node dist/lsp-mcp.js");
      process.exit(1);
    }

    const server = new BaseMcpServer({
      name: "lsp",
      version: "1.0.0",
      description: "Generic LSP-based tools for MCP",
      capabilities: {
        tools: true,
      },
    });
    
    server.setDefaultRoot(projectRoot);
    server.registerTools(tools);

    // Initialize LSP client
    const [lspCommand, ...lspArgs] = LSP_COMMAND.split(" ");
    const lspProcess = spawn(lspCommand, lspArgs, {
      cwd: projectRoot,
      stdio: ["pipe", "pipe", "pipe"],
    });
    
    await initializeLSPClient(projectRoot, lspProcess, "typescript");
    debug(`Initialized LSP client with command: ${LSP_COMMAND}`);

    // Connect transport and start server
    const transport = new StdioServerTransport();
    await server.getServer().connect(transport);
    
    debug("LSP Refactoring MCP Server running on stdio");
    debug(`Project root: ${projectRoot}`);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});