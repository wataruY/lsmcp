import { type Project } from "ts-morph";
import path from "path";
import fs from "fs/promises";
import { getOrCreateProject, getOrCreateSourceFileWithRefresh } from "../projectCache.ts";
import { resolveLineParameterForSourceFile as resolveLineParameter } from "../../textUtils/resolveLineParameterForSourceFile.ts";
import { findSymbolInLineForSourceFile as findSymbolInLine } from "../../textUtils/findSymbolInLineForSourceFile.ts";
import { formatError, ErrorContext } from "../../mcp/utils/errorHandler.ts";

export interface BaseToolParams {
  root: string;
  filePath: string;
  line: number | string;
  symbolName: string;
}

export interface PreparedContext {
  project: Project;
  absolutePath: string;
  sourceFile: any;
  resolvedLine: number;
  column: number;
}

/**
 * Common preparation for TypeScript navigation tools
 * Handles file validation, project loading, and symbol location
 */
export async function prepareToolContext(params: BaseToolParams): Promise<PreparedContext> {
  const { root, filePath, line, symbolName } = params;
  
  // Always treat paths as relative to root
  const absolutePath = path.join(root, filePath);
  const relativePath = path.relative(root, absolutePath);

  // Check if file exists
  try {
    await fs.access(absolutePath);
  } catch (error) {
    const context: ErrorContext = {
      operation: "TypeScript file access",
      filePath: relativePath,
      language: "typescript"
    };
    throw new Error(formatError(error, context));
  }

  // Get or create project
  let project: Project;
  try {
    project = await getOrCreateProject(absolutePath);
  } catch (error) {
    const context: ErrorContext = {
      operation: "TypeScript project initialization",
      filePath: relativePath,
      language: "typescript"
    };
    throw new Error(formatError(error, context));
  }

  // Ensure the source file is loaded in the project with fresh content
  const sourceFile = getOrCreateSourceFileWithRefresh(absolutePath);

  // Resolve line parameter
  const resolvedLine = resolveLineParameter(sourceFile, line);

  // Find the symbol in the line and get column position
  try {
    const { column } = findSymbolInLine(sourceFile, resolvedLine, symbolName);
    
    return {
      project,
      absolutePath,
      sourceFile,
      resolvedLine,
      column
    };
  } catch (error) {
    const context: ErrorContext = {
      operation: "symbol location",
      filePath: relativePath,
      symbolName,
      language: "typescript",
      details: { line, resolvedLine }
    };
    throw new Error(formatError(error, context));
  }
}

/**
 * Format file path relative to root for display
 */
export function formatRelativePath(absolutePath: string, root: string): string {
  return path.relative(root, absolutePath);
}