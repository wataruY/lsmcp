#!/usr/bin/env node
/**
 * Unified MCP server entry point that can start different language servers
 * based on command line arguments or auto-detection.
 */

import { parseArgs } from "node:util";
import { existsSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";
import { debug } from "./_mcplib.ts";
import { detectProjectLanguage, getLanguageInfo, LANGUAGE_CONFIGS } from "../common/languageDetection.ts";

// Parse command line arguments
const { values, positionals } = parseArgs({
  options: {
    language: {
      type: 'string',
      short: 'l',
      description: 'Language to use (typescript, moonbit, rust, etc.)'
    },
    'init': {
      type: 'string',
      description: 'Initialize MCP configuration (claude or global)'
    },
    help: {
      type: 'boolean',
      short: 'h',
      description: 'Show help message'
    },
    list: {
      type: 'boolean',
      description: 'List supported languages'
    },
  },
  allowPositionals: true,
});

function showHelp() {
  console.log(`
🌍 Unified MCP Server - Multi-Language Support

Usage:
  mcp [options]
  mcp --language <lang> [options]
  mcp --init <target>

Options:
  -l, --language <lang>  Language to use (typescript, moonbit, rust, etc.)
  --init <target>        Initialize MCP configuration (claude or global)
  --list                 List all supported languages
  -h, --help            Show this help message

Examples:
  mcp                    Auto-detect project language
  mcp -l rust           Use Rust MCP server
  mcp -l typescript     Use TypeScript MCP server
  mcp --init claude     Initialize for Claude Desktop

Supported Languages:
${Object.entries(LANGUAGE_CONFIGS)
  .map(([lang, config]) => `  - ${lang}: ${config.fileExtensions.join(", ")}`)
  .join("\n")}

Environment Variables:
  PROJECT_ROOT          Override project root directory
  FORCE_LANGUAGE        Force a specific language (same as -l)
`);
}

async function runLanguageServer(language: string, args: string[] = []) {
  const projectRoot = process.env.PROJECT_ROOT || process.cwd();
  
  // Map language to specific MCP server
  const languageServers: Record<string, string> = {
    typescript: "typescript-mcp.js",
    javascript: "typescript-mcp.js", // Use TypeScript server for JS
    moonbit: "moonbit-mcp.js",
    rust: "rust-mcp.js",
    // For other languages, use multi-language-mcp with FORCE_LANGUAGE
  };

  let serverFile = languageServers[language];
  let env = { ...process.env };

  if (!serverFile) {
    // Use multi-language MCP for other languages
    serverFile = "multi-language-mcp.js";
    env.FORCE_LANGUAGE = language;
  }

  // Resolve server path
  const distDir = join(__dirname);
  const serverPath = join(distDir, serverFile);

  if (!existsSync(serverPath)) {
    console.error(`Error: MCP server not found at ${serverPath}`);
    console.error(`Make sure to build the project first with: pnpm build`);
    process.exit(1);
  }

  debug(`Starting ${language} MCP server: ${serverPath}`);

  // Forward all arguments to the specific server
  const serverProcess = spawn("node", [serverPath, ...args], {
    stdio: "inherit",
    env,
  });

  serverProcess.on("error", (error) => {
    console.error(`Failed to start ${language} MCP server:`, error);
    process.exit(1);
  });

  serverProcess.on("exit", (code) => {
    process.exit(code || 0);
  });
}

async function main() {
  // Show help if requested
  if (values.help) {
    showHelp();
    process.exit(0);
  }

  // List languages if requested
  if (values.list) {
    console.log("Supported languages:");
    for (const [lang, config] of Object.entries(LANGUAGE_CONFIGS)) {
      console.log(`  ${lang}: ${config.fileExtensions.join(", ")}`);
    }
    process.exit(0);
  }

  // Handle initialization
  if (values.init) {
    // For init, we need to determine which language server to initialize
    const language = values.language || process.env.FORCE_LANGUAGE;
    
    if (language) {
      // Run specific language server with --init
      await runLanguageServer(language, [`--init=${values.init}`]);
    } else {
      // Auto-detect and initialize
      const detectedLang = detectProjectLanguage(process.cwd());
      if (detectedLang) {
        console.log(`Detected ${detectedLang.languageId} project`);
        await runLanguageServer(detectedLang.languageId, [`--init=${values.init}`]);
      } else {
        console.error("Could not detect project language.");
        console.error("Please specify a language with --language or create a project config file.");
        process.exit(1);
      }
    }
    return;
  }

  // Determine language
  let language = values.language || process.env.FORCE_LANGUAGE;

  if (!language) {
    // Auto-detect language
    const projectRoot = process.env.PROJECT_ROOT || process.cwd();
    const detected = detectProjectLanguage(projectRoot);
    
    if (detected) {
      language = detected.languageId;
      debug(`Auto-detected language: ${language}`);
    } else {
      console.error("Error: Could not detect project language.");
      console.error("Please specify a language with --language or set FORCE_LANGUAGE.");
      console.error("\nRun 'mcp --help' for more information.");
      process.exit(1);
    }
  }

  // Validate language
  const languageInfo = getLanguageInfo(language);
  if (!languageInfo) {
    console.error(`Error: Unsupported language: ${language}`);
    console.error("\nSupported languages:");
    Object.keys(LANGUAGE_CONFIGS).forEach(lang => {
      console.error(`  - ${lang}`);
    });
    process.exit(1);
  }

  // Run the appropriate language server
  await runLanguageServer(language, positionals);
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("/unified-mcp.js")) {
  main().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}