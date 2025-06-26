import { type Project } from "ts-morph";
import path from "path";
import fs from "fs/promises";
import { getOrCreateProject, getOrCreateSourceFileWithRefresh } from "../projectCache.ts";
import { resolveLineParameterForSourceFile as resolveLineParameter } from "../../textUtils/resolveLineParameterForSourceFile.ts";
import { findSymbolInLineForSourceFile as findSymbolInLine } from "../../textUtils/findSymbolInLineForSourceFile.ts";

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

  // Check if file exists
  await fs.access(absolutePath);

  const project = await getOrCreateProject(absolutePath);

  // Ensure the source file is loaded in the project with fresh content
  const sourceFile = getOrCreateSourceFileWithRefresh(absolutePath);

  // Resolve line parameter
  const resolvedLine = resolveLineParameter(sourceFile, line);

  // Find the symbol in the line and get column position
  const { column } = findSymbolInLine(sourceFile, resolvedLine, symbolName);

  return {
    project,
    absolutePath,
    sourceFile,
    resolvedLine,
    column
  };
}

/**
 * Format file path relative to root for display
 */
export function formatRelativePath(absolutePath: string, root: string): string {
  return path.relative(root, absolutePath);
}