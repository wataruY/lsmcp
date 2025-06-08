#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import { moveFile } from "../commands/move_file.ts";
import { renameSymbol } from "../commands/rename_symbol.ts";
import { deleteSymbol } from "../commands/delete_symbol.ts";
import { findReferences } from "../navigations/find_references.ts";
import { goToDefinition } from "../navigations/go_to_definition.ts";
import { getDiagnostics } from "../navigations/get_diagnostics.ts";
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

    const project = await findProjectForFile(absoluteOldPath);

    // Ensure the source file is loaded in the project
    let sourceFile = project.getSourceFile(absoluteOldPath);
    if (!sourceFile) {
      // Try to add the file if it's not in the project (e.g., excluded in tsconfig)
      try {
        sourceFile = project.addSourceFileAtPath(absoluteOldPath);
      } catch (error) {
        throw new Error(`File not found: ${absoluteOldPath}`);
      }
    }

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
    const project = await findProjectForFile(absolutePath);

    // Ensure the source file is loaded in the project
    let sourceFile = project.getSourceFile(absolutePath);
    if (!sourceFile) {
      // Try to add the file if it's not in the project (e.g., excluded in tsconfig)
      try {
        sourceFile = project.addSourceFileAtPath(absolutePath);
      } catch (error) {
        throw new Error(`File not found: ${absolutePath}`);
      }
    }

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

// Tool: Delete Symbol
server.tool(
  "delete-symbol",
  "Delete a TypeScript/JavaScript symbol (variable, function, class, etc.) and all its references",
  {
    filePath: z
      .string()
      .describe("File path containing the symbol (relative to root)"),
    line: z
      .number()
      .describe("Line number where the symbol is defined (1-based)"),
    symbolName: z.string().describe("Name of the symbol to delete"),
    removeReferences: z
      .boolean()
      .optional()
      .default(true)
      .describe("Also delete all references to the symbol"),
    root: z.string().describe("Root directory for resolving relative paths"),
  },
  toMcpToolHandler(async ({ filePath, line, symbolName, root }) => {
    // Always treat paths as relative to root
    const absolutePath = path.join(root, filePath);

    // Check if file exists
    await fs.access(absolutePath);

    const project = await findProjectForFile(absolutePath);

    // Ensure the source file is loaded in the project
    let sourceFile = project.getSourceFile(absolutePath);
    if (!sourceFile) {
      // Try to add the file if it's not in the project (e.g., excluded in tsconfig)
      try {
        sourceFile = project.addSourceFileAtPath(absolutePath);
      } catch (error) {
        throw new Error(`File not found: ${absolutePath}`);
      }
    }

    // Perform the removal
    const result = await deleteSymbol(project, {
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
  })
);

// Tool: Find References
server.tool(
  "find-references",
  "Find all references to a TypeScript/JavaScript symbol across the codebase",
  {
    filePath: z
      .string()
      .describe("File path containing the symbol (relative to root)"),
    line: z
      .number()
      .describe("Line number where the symbol is located (1-based)"),
    column: z
      .number()
      .describe("Column number where the symbol is located (1-based)"),
    root: z.string().describe("Root directory for resolving relative paths"),
  },
  toMcpToolHandler(async ({ filePath, line, column, root }) => {
    // Always treat paths as relative to root
    const absolutePath = path.join(root, filePath);

    // Check if file exists
    await fs.access(absolutePath);

    const project = await findProjectForFile(absolutePath);

    // Ensure the source file is loaded in the project
    let sourceFile = project.getSourceFile(absolutePath);
    if (!sourceFile) {
      // Try to add the file if it's not in the project (e.g., excluded in tsconfig)
      try {
        sourceFile = project.addSourceFileAtPath(absolutePath);
      } catch (error) {
        throw new Error(`File not found: ${absolutePath}`);
      }
    }

    // Find references
    const result = findReferences(project, {
      filePath: absolutePath,
      line,
      column,
    });

    if (result.isErr()) {
      throw new Error(result.error);
    }

    const { message, references, symbol } = result.value;

    // Format the output
    const output = [
      message,
      `Symbol: ${symbol.name} (${symbol.kind})`,
      "",
      "References:",
    ];

    for (const ref of references) {
      const relativePath = path.relative(root, ref.filePath);
      output.push(
        `  ${relativePath}:${ref.line}:${ref.column} - ${ref.lineText}`
      );
    }

    return output.join("\n");
  })
);

// Tool: Get Definitions
server.tool(
  "get-definitions",
  "Get the definition(s) of a TypeScript/JavaScript symbol",
  {
    filePath: z
      .string()
      .describe("File path containing the symbol (relative to root)"),
    line: z
      .number()
      .describe("Line number where the symbol is located (1-based)"),
    symbolName: z
      .string()
      .describe("Name of the symbol to get definitions for"),
    root: z.string().describe("Root directory for resolving relative paths"),
    before: z
      .number()
      .optional()
      .describe("Number of lines to show before the definition"),
    after: z
      .number()
      .optional()
      .describe("Number of lines to show after the definition"),
  },
  toMcpToolHandler(async ({ filePath, line, symbolName, root, before, after }) => {
    // Always treat paths as relative to root
    const absolutePath = path.join(root, filePath);

    // Check if file exists
    await fs.access(absolutePath);

    const project = await findProjectForFile(absolutePath);

    // Get the source file to find the column position
    let sourceFile = project.getSourceFile(absolutePath);
    if (!sourceFile) {
      // Try to add the file if it's not in the project (e.g., excluded in tsconfig)
      try {
        sourceFile = project.addSourceFileAtPath(absolutePath);
      } catch (error) {
        throw new Error(`File not found: ${absolutePath}`);
      }
    }

    // Get the line text
    const fullText = sourceFile.getFullText();
    const lines = fullText.split("\n");
    const lineText = lines[line - 1];

    if (!lineText) {
      throw new Error(`Invalid line number: ${line}`);
    }

    // Find the column position of the symbol in the line
    const symbolIndex = lineText.indexOf(symbolName);
    if (symbolIndex === -1) {
      throw new Error(`Symbol "${symbolName}" not found on line ${line}`);
    }

    // Convert to 1-based column (symbolIndex is 0-based)
    const column = symbolIndex + 1;

    // Find definition using the column position
    const result = goToDefinition(project, {
      filePath: absolutePath,
      line,
      column,
    });

    if (result.isErr()) {
      throw new Error(result.error);
    }

    const { message, definitions, symbol } = result.value;

    // Format the output
    const output = [
      message,
      `Symbol: ${symbol.name} (${symbol.kind})`,
      "",
      "Definitions:",
    ];

    for (const def of definitions) {
      const relativePath = path.relative(root, def.filePath);
      output.push(
        `  ${relativePath}:${def.line}:${def.column} - ${def.lineText}`
      );
      
      // Add context lines if requested
      if (before || after) {
        const defSourceFile = project.getSourceFile(def.filePath);
        if (defSourceFile) {
          const fullText = defSourceFile.getFullText();
          const lines = fullText.split("\n");
          
          const startLine = Math.max(0, def.line - 1 - (before || 0));
          const endLine = Math.min(lines.length, def.line + (after || 0));
          
          if (before && startLine < def.line - 1) {
            output.push("");
            for (let i = startLine; i < def.line - 1; i++) {
              output.push(`    ${i + 1}: ${lines[i]}`);
            }
          }
          
          // Show the definition line with arrow
          output.push(`  → ${def.line}: ${lines[def.line - 1]}`);
          
          if (after && def.line < endLine) {
            for (let i = def.line; i < endLine; i++) {
              output.push(`    ${i + 1}: ${lines[i]}`);
            }
          }
        }
      }
    }

    return output.join("\n");
  })
);

// Tool: Get Diagnostics
server.tool(
  "get-diagnostics",
  "Get TypeScript diagnostics (errors, warnings) for a single file",
  {
    filePath: z
      .string()
      .describe("File path to check for diagnostics (relative to root)"),
    root: z.string().describe("Root directory for resolving relative paths"),
  },
  toMcpToolHandler(async ({ filePath, root }) => {
    // Always treat paths as relative to root
    const absolutePath = path.join(root, filePath);

    // Check if file exists
    await fs.access(absolutePath);

    const project = await findProjectForFile(absolutePath);

    // Ensure the source file is loaded in the project
    let sourceFile = project.getSourceFile(absolutePath);
    if (!sourceFile) {
      // Try to add the file if it's not in the project (e.g., excluded in tsconfig)
      try {
        sourceFile = project.addSourceFileAtPath(absolutePath);
      } catch (error) {
        throw new Error(`File not found: ${absolutePath}`);
      }
    }

    // Get diagnostics
    const result = getDiagnostics(project, {
      filePaths: [absolutePath],
    });

    if (result.isErr()) {
      throw new Error(result.error);
    }

    const { message } = result.value;
    
    // Return ts-morph's formatted output directly
    return message;
  })
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
