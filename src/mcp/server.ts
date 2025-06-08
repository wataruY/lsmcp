#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Project } from "ts-morph";
import * as path from "path";
import * as fs from "fs/promises";
import { moveFile } from "../commands/move_file.js";
import { renameSymbol } from "../commands/rename_symbol.js";
import { removeSymbol } from "../commands/remove_symbol.js";

const server = new McpServer({
  name: "typescript",
  version: "1.0.0",
});

// Create a project instance that will be reused
let project: Project | null = null;

async function getOrCreateProject(workingDir?: string): Promise<Project> {
  if (!project) {
    project = new Project({
      skipFileDependencyResolution: true,
      compilerOptions: {
        allowJs: true,
        jsx: "preserve" as any,
      },
    });

    // If working directory is provided, try to load tsconfig
    if (workingDir) {
      const tsconfigPath = path.join(workingDir, "tsconfig.json");
      try {
        await fs.access(tsconfigPath);
        project = new Project({
          tsConfigFilePath: tsconfigPath,
          skipFileDependencyResolution: true,
        });
      } catch {
        // Use default project if tsconfig not found
      }
    }
  }
  return project;
}

// Tool: Move File
server.tool(
  "ts-move-file",
  "Move a TypeScript/JavaScript file to a new location and update all import statements",
  {
    oldPath: z.string().describe("Current file path (absolute or relative)"),
    newPath: z.string().describe("New file path (absolute or relative)"),
    workingDir: z
      .string()
      .optional()
      .describe("Working directory for relative paths"),
  },
  async ({ oldPath, newPath, workingDir }) => {
    try {
      const cwd = workingDir || process.cwd();
      const absoluteOldPath = path.isAbsolute(oldPath)
        ? oldPath
        : path.join(cwd, oldPath);
      const absoluteNewPath = path.isAbsolute(newPath)
        ? newPath
        : path.join(cwd, newPath);

      // Check if source file exists
      await fs.access(absoluteOldPath);

      const project = await getOrCreateProject(cwd);

      // Add the source file if not already in project
      if (!project.getSourceFile(absoluteOldPath)) {
        project.addSourceFileAtPath(absoluteOldPath);
      }

      // Also add any TypeScript/JavaScript files in the same directory to catch imports
      const dir = path.dirname(absoluteOldPath);
      const files = await fs.readdir(dir);
      for (const file of files) {
        if (file.match(/\.(ts|tsx|js|jsx)$/)) {
          const filePath = path.join(dir, file);
          if (!project.getSourceFile(filePath)) {
            try {
              project.addSourceFileAtPath(filePath);
            } catch {
              // Ignore files that can't be added
            }
          }
        }
      }

      // Perform the move
      moveFile(project, {
        oldFilename: absoluteOldPath,
        newFilename: absoluteNewPath,
      });

      // Save all changes
      await project.save();

      return {
        content: [
          {
            type: "text",
            text: `Successfully moved file from ${oldPath} to ${newPath}. All import statements have been updated.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error moving file: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Rename Symbol
server.tool(
  "ts-rename-symbol",
  "Rename a TypeScript/JavaScript symbol (variable, function, class, etc.) across the codebase",
  {
    filePath: z.string().describe("File path containing the symbol"),
    line: z
      .number()
      .describe("Line number where the symbol is defined (1-based)"),
    column: z
      .number()
      .optional()
      .describe("Column number where the symbol is defined (1-based)"),
    oldName: z.string().describe("Current name of the symbol"),
    newName: z.string().describe("New name for the symbol"),
    workingDir: z
      .string()
      .optional()
      .describe("Working directory for relative paths"),
  },
  async ({ filePath, line, oldName, newName, workingDir }) => {
    try {
      const cwd = workingDir || process.cwd();
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(cwd, filePath);

      // Check if file exists
      await fs.access(absolutePath);

      const project = await getOrCreateProject(cwd);

      // Add the source file if not already in project
      if (!project.getSourceFile(absolutePath)) {
        project.addSourceFileAtPath(absolutePath);
      }

      // Add related files in the project
      const dir = path.dirname(absolutePath);
      const files = await fs.readdir(dir);
      for (const file of files) {
        if (file.match(/\.(ts|tsx|js|jsx)$/)) {
          const fp = path.join(dir, file);
          if (!project.getSourceFile(fp)) {
            try {
              project.addSourceFileAtPath(fp);
            } catch {
              // Ignore files that can't be added
            }
          }
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

      if (result.success) {
        // Save all changes
        await project.save();

        const changedFilesCount = result.changedFiles.length;
        return {
          content: [
            {
              type: "text",
              text: `Successfully renamed symbol "${oldName}" to "${newName}" in ${changedFilesCount} file(s).`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: `Failed to rename symbol: ${result.error}`,
            },
          ],
          isError: true,
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error renaming symbol: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Remove Symbol
server.tool(
  "ts-remove-symbol",
  "Remove a TypeScript/JavaScript symbol (variable, function, class, etc.) and all its references",
  {
    filePath: z.string().describe("File path containing the symbol"),
    line: z
      .number()
      .describe("Line number where the symbol is defined (1-based)"),
    symbolName: z.string().describe("Name of the symbol to remove"),
    removeReferences: z
      .boolean()
      .optional()
      .default(true)
      .describe("Also remove all references to the symbol"),
    workingDir: z
      .string()
      .optional()
      .describe("Working directory for relative paths"),
  },
  async ({ filePath, line, symbolName, removeReferences, workingDir }) => {
    try {
      const cwd = workingDir || process.cwd();
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(cwd, filePath);

      // Check if file exists
      await fs.access(absolutePath);

      const project = await getOrCreateProject(cwd);

      // Add the source file if not already in project
      if (!project.getSourceFile(absolutePath)) {
        project.addSourceFileAtPath(absolutePath);
      }

      // Add related files if removing references
      if (removeReferences) {
        const dir = path.dirname(absolutePath);
        const files = await fs.readdir(dir);
        for (const file of files) {
          if (file.match(/\.(ts|tsx|js|jsx)$/)) {
            const fp = path.join(dir, file);
            if (!project.getSourceFile(fp)) {
              try {
                project.addSourceFileAtPath(fp);
              } catch {
                // Ignore files that can't be added
              }
            }
          }
        }
      }

      // Perform the removal
      const result = await removeSymbol(project, {
        filePath: absolutePath,
        line,
        symbolName,
      });

      if (result.success) {
        // Save all changes
        await project.save();

        const message = `Successfully removed symbol "${symbolName}" from ${result.removedFromFiles.length} file(s).`;

        return {
          content: [
            {
              type: "text",
              text: message,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: `Failed to remove symbol: ${result.error}`,
            },
          ],
          isError: true,
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error removing symbol: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }
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
