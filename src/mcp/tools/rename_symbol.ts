import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import { renameSymbol } from "../../commands/rename_symbol.ts";
import {
  findProjectForFile,
  getOrCreateSourceFileWithRefresh,
} from "../../utils/project_cache.ts";
import { resolveLineParameter } from "../line_utils.ts";
import type { ToolDef } from "../types.ts";

const schema = z.object({
  filePath: z
    .string()
    .describe("File path containing the symbol (relative to root)"),
  line: z
    .union([z.number(), z.string()])
    .describe("Line number (1-based) or string to match in the line"),
  oldName: z.string().describe("Current name of the symbol"),
  newName: z.string().describe("New name for the symbol"),
  root: z.string().describe("Root directory for resolving relative paths"),
});

export interface RenameSymbolResult {
  message: string;
  changedFiles: Array<{
    filePath: string;
    changes: Array<{
      line: number;
      column: number;
      oldText: string;
      newText: string;
    }>;
  }>;
}

export async function handleRenameSymbol({
  filePath,
  line,
  oldName,
  newName,
  root,
}: z.infer<typeof schema>): Promise<RenameSymbolResult> {
  // Always treat paths as relative to root
  const absolutePath = path.join(root, filePath);
  // Check if file exists
  const project = await findProjectForFile(absolutePath);

  // Ensure the source file is loaded in the project with fresh content
  const sourceFile = await getOrCreateSourceFileWithRefresh(absolutePath);

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
    throw new Error(result.error);
  }

  // Save all changes
  await project.save();

  return result.value;
}

export async function formatRenameSymbolResult(result: RenameSymbolResult, root: string): Promise<string> {
  const { message, changedFiles } = result;
  const totalChanges = changedFiles.reduce(
    (sum, file) => sum + file.changes.length,
    0
  );
  
  const output = [
    `${message} in ${changedFiles.length} file(s) with ${totalChanges} change(s).`,
    "",
    "Changes:",
  ];
  
  for (const file of changedFiles) {
    const relativePath = path.relative(root, file.filePath);
    output.push(`  ${relativePath}:`);
    
    try {
      // Read the current file content to show full lines
      const content = await fs.readFile(file.filePath, 'utf-8');
      const lines = content.split('\n');
      
      // Group changes by line to handle multiple changes on the same line
      const changesByLine = new Map<number, typeof file.changes>();
      for (const change of file.changes) {
        const lineChanges = changesByLine.get(change.line) || [];
        lineChanges.push(change);
        changesByLine.set(change.line, lineChanges);
      }
      
      // Process each line with changes
      for (const [lineNum, lineChanges] of changesByLine) {
        const lineIndex = lineNum - 1; // Convert to 0-based
        if (lineIndex >= 0 && lineIndex < lines.length) {
          let oldLine = lines[lineIndex];
          let newLine = oldLine;
          
          // Sort changes by column in reverse order to avoid position shifts
          const sortedChanges = [...lineChanges].sort((a, b) => b.column - a.column);
          
          for (const change of sortedChanges) {
            // Replace at specific position
            const before = newLine.substring(0, change.column - 1);
            const after = newLine.substring(change.column - 1 + change.oldText.length);
            newLine = before + change.newText + after;
          }
          
          output.push(`    @@ -${lineNum},1 +${lineNum},1 @@`);
          output.push(`    - ${oldLine}`);
          output.push(`    + ${newLine}`);
        }
      }
    } catch (error) {
      // Fallback to simple format if file reading fails
      for (const change of file.changes) {
        output.push(`    Line ${change.line}: "${change.oldText}" → "${change.newText}"`);
      }
    }
  }
  
  return output.join("\n");
}

export const renameSymbolTool: ToolDef<typeof schema> = {
  name: "rename_symbol",
  description:
    "Rename a TypeScript symbol (variable, function, class, etc.) across the codebase",
  schema,
  handler: async (args) => {
    const result = await handleRenameSymbol(args);
    return await formatRenameSymbolResult(result, args.root);
  },
};
