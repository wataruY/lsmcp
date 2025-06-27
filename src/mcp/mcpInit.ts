import { parseArgs } from "node:util";
import { generatePermissions, initializeMcpConfig } from "./_mcplib.ts";
import type { ToolDef } from "./_mcplib.ts";

export interface McpInitOptions {
  projectName: string;
  toolPrefix: string;
  validTargets?: string[];
  envConfig?: Record<string, string>;
  globalCommand?: string;
}

export async function handleMcpInit(
  tools: ToolDef<any>[],
  options: McpInitOptions
): Promise<boolean> {
  const { values } = parseArgs({
    options: {
      init: {
        type: "string",
      },
    },
    strict: true,
    allowPositionals: false,
  });

  // Project root is always the current working directory
  // TODO: When MCP adds client cwd support, use that
  const projectRoot = process.cwd();

  // Handle initialization
  if (values.init !== undefined) {
    const target = values.init || "claude";
    const validTargets = options.validTargets || ["claude", "global"];
    
    if (!validTargets.includes(target)) {
      console.error(
        `Unknown init target: ${target}. Supported: ${validTargets.join(", ")}`
      );
      process.exit(1);
    }

    const isGlobal = target === "global";
    
    // Configure command
    const config = {
      command: "node",
      args: isGlobal && options.globalCommand
        ? ["npx", "-y", options.globalCommand]
        : [`dist/${options.projectName}.js`],
      env: options.envConfig,
    };

    // Generate permissions from tool definitions
    const permissions = generatePermissions(options.toolPrefix, tools);

    initializeMcpConfig(
      projectRoot,
      options.toolPrefix,
      config,
      permissions
    );

    console.log(
      `✓ Created/updated .mcp.json with ${options.projectName} configuration`
    );
    console.log(`✓ Created/updated .claude/settings.json with permissions`);
    
    if (options.envConfig) {
      console.log(
        `\n⚠️  Important: Set the required environment variables in .mcp.json`
      );
      Object.entries(options.envConfig).forEach(([key, value]) => {
        console.log(`   ${key}: "${value}"`);
      });
    }
    
    return true;
  }

  return false;
}