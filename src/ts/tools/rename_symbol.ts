import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import { type Result, ok, err } from "neverthrow";
import { renameSymbol } from "../commands/rename_symbol";
import {
  findProjectForFile,
  getOrCreateSourceFileWithRefresh,
} from "../project_cache";
import { resolveLineParameter } from "../../mcp/line_utils";
import type { ToolDef } from "../../mcp/types";

const schema = z.object({
  root: z.string().describe("Root directory for resolving relative paths"),
  filePath: z
    .string()
    .describe("File path containing the symbol (relative to root)"),
  line: z
    .union([z.number(), z.string()])
    .describe("Line number (1-based) or string to match in the line"),
  oldName: z.string().describe("Current name of the symbol"),
  newName: z.string().describe("New name for the symbol"),
});

export interface RenameSymbolResult {
  message: string;
  changedFiles: {
    filePath: string;
    changes: {
      line: number;
      column: number;
      oldText: string;
      newText: string;
    }[];
  }[];
}

export async function handleRenameSymbol({
  root,
  filePath,
  line,
  oldName,
  newName,
}: z.infer<typeof schema>): Promise<Result<RenameSymbolResult, string>> {
  // Always treat paths as relative to root
  const absolutePath = path.join(root, filePath);

  // Check if file exists
  const project = findProjectForFile(absolutePath);

  // Ensure the source file is loaded in the project with fresh content
  const sourceFile = getOrCreateSourceFileWithRefresh(absolutePath);

  // Resolve line parameter
  const resolvedLine = resolveLineParameter(sourceFile, line);

  // Perform the rename
  const result = await renameSymbol(project, {
    filePath: absolutePath,
    line: resolvedLine,
    symbolName: oldName,
    newName,
    renameInStrings: true,
    renameInComments: false,
  });

  if (result.isErr()) {
    return err(result.error);
  }

  // Save all changes
  await project.save();

  return ok(result.value);
}

async function formatFileChanges(
  file: RenameSymbolResult["changedFiles"][0],
  root: string
): Promise<Result<string[], string>> {
  const relativePath = path.relative(root, file.filePath);
  const output = [`  ${relativePath}:`];

  // Try to read the file content
  const contentResult = await fs
    .readFile(file.filePath, "utf-8")
    .then((content) => ok(content))
    .catch((error: unknown) =>
      err(error instanceof Error ? error.message : String(error))
    );

  if (contentResult.isErr()) {
    // Fallback to simple format if file reading fails
    const fallbackLines = file.changes.map(
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
  const changesByLine = Object.groupBy(file.changes, (change) => change.line);

  // Process each line with changes
  const formattedChanges = Object.entries(changesByLine).flatMap(
    ([lineNumStr, lineChanges]) => {
      if (!lineChanges) return [];

      const lineNum = Number(lineNumStr);
      const lineIndex = lineNum - 1; // Convert to 0-based
      if (lineIndex < 0 || lineIndex >= lines.length) return [];

      const oldLine = lines[lineIndex];
      // Sort changes by column in reverse order to avoid position shifts
      const sortedChanges = [...lineChanges].sort(
        (a, b) => b.column - a.column
      );

      // Apply all changes to the line
      const newLine = sortedChanges.reduce((line, change) => {
        const before = line.substring(0, change.column - 1);
        const after = line.substring(change.column - 1 + change.oldText.length);
        return before + change.newText + after;
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

export async function formatRenameSymbolResult(
  result: RenameSymbolResult,
  root: string
): Promise<Result<string, string>> {
  const { message, changedFiles } = result;
  const totalChanges = changedFiles.reduce(
    (sum, file) => sum + file.changes.length,
    0
  );

  const output = [
    `${message} in ${String(changedFiles.length)} file(s) with ${String(
      totalChanges
    )} change(s).`,
    "",
    "Changes:",
  ];

  // Process all files and collect their formatted changes
  const fileResults = await Promise.all(
    changedFiles.map((file) => formatFileChanges(file, root))
  );

  // Check if any file processing failed
  for (const fileResult of fileResults) {
    if (fileResult.isErr()) {
      return err(fileResult.error);
    }
    output.push(...fileResult.value);
  }

  return ok(output.join("\n"));
}

export const renameSymbolTool: ToolDef<typeof schema> = {
  name: "rename_symbol",
  description:
    "Rename a TypeScript symbol (variable, function, class, etc.) across the codebase",
  schema,
  handler: async (args) => {
    const result = await handleRenameSymbol(args);
    if (result.isErr()) {
      throw new Error(result.error);
    }

    const formattedResult = await formatRenameSymbolResult(
      result.value,
      args.root
    );
    if (formattedResult.isErr()) {
      throw new Error(formattedResult.error);
    }

    return formattedResult.value;
  },
};
