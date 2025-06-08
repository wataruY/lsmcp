#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import { moveFile } from "../commands/move_file.ts";
import { renameSymbol } from "../commands/rename_symbol.ts";
import { removeSymbol } from "../commands/remove_symbol.ts";
import { findProjectForFile } from "../utils/project_cache.ts";
import { toMcpToolHandler } from "./mcp_server_utils.ts";

const server = new McpServer({
  name: "typescript",
  version: "1.0.0",
});

// Tool: Move File
server.tool(
  "move-file",
  "Move a TypeScript/JavaScript file to a new location and update all import statements",
  {
    oldPath: z.string().describe("Current file path (relative to root)"),
    newPath: z.string().describe("New file path (relative to root)"),
    root: z.string().describe("Root directory for resolving relative paths"),
    overwrite: z
      .boolean()
      .optional()
      .default(false)
      .describe("Overwrite the destination file if it exists"),
  },
  toMcpToolHandler(async ({ oldPath, newPath, root, overwrite }) => {
    // Always treat paths as relative to root
    const absoluteOldPath = path.join(root, oldPath);
    const absoluteNewPath = path.join(root, newPath);

    // Check if source file exists
    await fs.access(absoluteOldPath);

    const project = await findProjectForFile(absoluteOldPath);

    // Add the source file if not already in project
    if (!project.getSourceFile(absoluteOldPath)) {
      project.addSourceFileAtPath(absoluteOldPath);
    }

    // The project should already have all necessary files loaded via tsconfig.json
    // If not, the findProjectForFile function should handle loading the project files

    // Perform the move
    const result = moveFile(project, {
      oldFilename: absoluteOldPath,
      newFilename: absoluteNewPath,
      overwrite,
    });

    if (result.isErr()) {
      throw new Error(result.error);
    }

    // Save all changes
    await project.save();

    const { message, changedFiles } = result.value;
    return `${message}. Updated imports in ${changedFiles.length} file(s).`;
  })
);

// Tool: Rename Symbol
server.tool(
  "rename-symbol",
  "Rename a TypeScript/JavaScript symbol (variable, function, class, etc.) across the codebase",
  {
    filePath: z
      .string()
      .describe("File path containing the symbol (relative to root)"),
    line: z
      .number()
      .describe("Line number where the symbol is defined (1-based)"),
    oldName: z.string().describe("Current name of the symbol"),
    newName: z.string().describe("New name for the symbol"),
    root: z.string().describe("Root directory for resolving relative paths"),
  },
  toMcpToolHandler(async ({ filePath, line, oldName, newName, root }) => {
    // Always treat paths as relative to root
    const absolutePath = path.join(root, filePath);

    // Check if file exists
    await fs.access(absolutePath);

    const project = await findProjectForFile(absolutePath);

    // Add the source file if not already in project
    if (!project.getSourceFile(absolutePath)) {
      project.addSourceFileAtPath(absolutePath);
    }

    // The project should already have all necessary files loaded via tsconfig.json
    // If not, the findProjectForFile function should handle loading the project files

    // Perform the rename
    const result = await renameSymbol(project, {
      filePath: absolutePath,
      line,
      symbolName: oldName,
      newName,
      renameInStrings: true,
      renameInComments: false,
    });

    if (result.isErr()) {
      throw new Error(result.error);
    }

    // Save all changes
    await project.save();

    const { message, changedFiles } = result.value;
    return `${message} in ${changedFiles.length} file(s).`;
  })
);

// Tool: Remove Symbol
server.tool(
  "remove-symbol",
  "Remove a TypeScript/JavaScript symbol (variable, function, class, etc.) and all its references",
  {
    filePath: z
      .string()
      .describe("File path containing the symbol (relative to root)"),
    line: z
      .number()
      .describe("Line number where the symbol is defined (1-based)"),
    symbolName: z.string().describe("Name of the symbol to remove"),
    removeReferences: z
      .boolean()
      .optional()
      .default(true)
      .describe("Also remove all references to the symbol"),
    root: z.string().describe("Root directory for resolving relative paths"),
  },
  toMcpToolHandler(
    async ({ filePath, line, symbolName, removeReferences, root }) => {
      // Always treat paths as relative to root
      const absolutePath = path.join(root, filePath);

      // Check if file exists
      await fs.access(absolutePath);

      const project = await findProjectForFile(absolutePath);

      // Add the source file if not already in project
      if (!project.getSourceFile(absolutePath)) {
        project.addSourceFileAtPath(absolutePath);
      }

      // The project should already have all necessary files loaded via tsconfig.json
      // If not, the findProjectForFile function should handle loading the project files

      // Perform the removal
      const result = await removeSymbol(project, {
        filePath: absolutePath,
        line,
        symbolName,
      });

      if (result.isErr()) {
        throw new Error(result.error);
      }

      // Save all changes
      await project.save();

      const { message, removedFromFiles } = result.value;
      return `${message} from ${removedFromFiles.length} file(s).`;
    }
  )
);

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
