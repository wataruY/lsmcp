/**
 * Common utilities for TypeScript tool handlers
 */
import { Project, SourceFile, Node } from "ts-morph";
import { ok, err, Result } from "neverthrow";
import path from "path";
import fs from "fs/promises";
import { getProjectCached } from "../projectCache.ts";
import { resolveLineParameter } from "../../textUtils/resolveLineParameter.ts";
import { findTargetInFile } from "../../textUtils/findTargetInFile.ts";
import ts from "typescript";

/**
 * Common context for tool operations
 */
export interface ToolContext {
  project: Project;
  sourceFile: SourceFile;
  root: string;
}

/**
 * Prepare a project and source file for a tool operation
 */
export async function prepareToolContext(
  root: string,
  filePath: string,
  tsconfigPath?: string
): Promise<Result<ToolContext, string>> {
  const projectResult = await getProjectCached(root, tsconfigPath);
  if (projectResult.isErr()) {
    return err(projectResult.error);
  }

  const project = projectResult.value.project;
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(root, filePath);

  let sourceFile = project.getSourceFile(absolutePath);
  if (!sourceFile) {
    // Try to add the source file
    try {
      sourceFile = project.addSourceFileAtPath(absolutePath);
    } catch (error) {
      return err(
        `Failed to add source file ${filePath}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  return ok({ project, sourceFile, root });
}

/**
 * Find a node at a specific line containing the target symbol
 */
export async function findNodeAtLine<T extends Node>(
  sourceFile: SourceFile,
  line: number | string,
  symbolName: string,
  nodeFilter?: (node: Node) => node is T
): Promise<Result<T, string>> {
  const lineResult = await resolveLineParameter(
    sourceFile.getFilePath(),
    line
  );

  if (lineResult.isErr()) {
    return err(lineResult.error);
  }

  const targetResult = await findTargetInFile(
    sourceFile.getFilePath(),
    symbolName,
    { lineNumber: lineResult.value }
  );

  if (targetResult.isErr()) {
    return err(targetResult.error);
  }

  const { offset } = targetResult.value;

  // Find the node at the target position
  const node = sourceFile.getDescendantAtPos(offset);
  if (!node) {
    return err(`Could not find node at position ${offset}`);
  }

  // Find the appropriate parent node
  let currentNode: Node | undefined = node;
  while (currentNode) {
    // If a filter is provided, use it
    if (nodeFilter && nodeFilter(currentNode)) {
      return ok(currentNode);
    }

    // Otherwise, look for common node types
    if (!nodeFilter) {
      const identifier = currentNode.asKind(ts.SyntaxKind.Identifier);
      if (identifier && identifier.getText() === symbolName) {
        const parent = identifier.getParent();
        if (parent) {
          return ok(parent as T);
        }
      }
    }

    currentNode = currentNode.getParent();
  }

  return err(
    `Could not find ${nodeFilter ? "matching" : "appropriate"} node for "${symbolName}" at line ${line}`
  );
}

/**
 * Format file changes for display
 */
export async function formatFileChanges(
  changes: Array<{
    line: number;
    oldText: string;
    newText: string;
  }>,
  filePath: string,
  root: string
): Promise<Result<string[], string>> {
  const relativePath = path.relative(root, filePath);
  const output = [`  ${relativePath}:`];

  // Try to read the file content
  const contentResult = await fs
    .readFile(filePath, "utf-8")
    .then((content) => ok(content))
    .catch((error: unknown) =>
      err(error instanceof Error ? error.message : String(error))
    );

  if (contentResult.isErr()) {
    // Fallback to simple format if file reading fails
    const fallbackLines = changes.map(
      (change) =>
        `    Line ${String(change.line)}: "${change.oldText}" → "${
          change.newText
        }"`
    );
    output.push(...fallbackLines);
    return ok(output);
  }

  const lines = contentResult.value.split("\n");

  // Group changes by line to handle multiple changes on the same line
  const changesByLine = Object.groupBy(changes, (change) => change.line);

  // Process each line with changes
  const formattedChanges = Object.entries(changesByLine).flatMap(
    ([lineNumStr, lineChanges]) => {
      if (!lineChanges) return [];

      const lineNum = Number(lineNumStr);
      const lineIndex = lineNum - 1; // Convert to 0-based
      if (lineIndex < 0 || lineIndex >= lines.length) return [];

      const oldLine = lines[lineIndex];
      
      // Simply replace old text with new text in the line
      const newLine = lineChanges.reduce((line, change) => {
        return line.replace(change.oldText, change.newText);
      }, oldLine);

      return [
        `    @@ -${String(lineNum)},1 +${String(lineNum)},1 @@`,
        `    - ${oldLine}`,
        `    + ${newLine}`,
      ];
    }
  );

  output.push(...formattedChanges);
  return ok(output);
}

/**
 * Apply file system changes and save the project
 */
export async function applyChanges(
  project: Project
): Promise<Result<void, string>> {
  try {
    await project.save();
    return ok(undefined);
  } catch (error) {
    return err(
      `Failed to save changes: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Format a file path relative to the root directory
 */
export function formatRelativePath(filePath: string, root: string): string {
  const relativePath = path.relative(root, filePath);
  return relativePath.startsWith("..") ? filePath : relativePath;
}