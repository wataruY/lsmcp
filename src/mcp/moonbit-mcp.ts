#!/usr/bin/env node
/**
 * MCP server for Moonbit language support.
 */

import { initializeLanguageMCP, LANGUAGE_SERVER_CONFIGS } from "./languageServerInit.ts";

async function main() {
  try {
    const config = LANGUAGE_SERVER_CONFIGS.moonbit;
    if (!config) {
      throw new Error("Moonbit configuration not found");
    }
    
    await initializeLanguageMCP(config);
  } catch (error) {
    console.error("Failed to start Moonbit MCP server:", error);
    process.exit(1);
  }
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("/moonbit-mcp.js")) {
  main();
}