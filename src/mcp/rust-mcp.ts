#!/usr/bin/env node
/**
 * MCP server for Rust language support.
 */

import { initializeLanguageMCP, LANGUAGE_SERVER_CONFIGS } from "./languageServerInit.ts";

async function main() {
  try {
    const config = LANGUAGE_SERVER_CONFIGS.rust;
    if (!config) {
      throw new Error("Rust configuration not found");
    }
    
    await initializeLanguageMCP(config);
  } catch (error) {
    console.error("Failed to start Rust MCP server:", error);
    process.exit(1);
  }
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("/rust-mcp.js")) {
  main();
}