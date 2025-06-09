import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import { moveFile } from "../commands/move_file";
import {
  findProjectForFile,
  getOrCreateSourceFileWithRefresh,
} from "../utils/project_cache";
import type { ToolDef } from "../mcp/types";

const schemaShape = {
  root: z.string().describe("Root directory for resolving relative paths"),
  oldPath: z.string().describe("Current file path (relative to root)"),
  newPath: z.string().describe("New file path (relative to root)"),
  overwrite: z
    .boolean()
    .optional()
    .default(false)
    .describe("Overwrite the destination file if it exists"),
};

const schema = z.object(schemaShape);

export interface MoveFileResult {
  message: string;
  changedFiles: string[];
}

export async function handleMoveFile({
  root,
  oldPath,
  newPath,
  overwrite,
}: z.infer<typeof schema>): Promise<MoveFileResult> {
  // Always treat paths as relative to root
  const absoluteOldPath = path.join(root, oldPath);
  const absoluteNewPath = path.join(root, newPath);

  const project = findProjectForFile(absoluteOldPath);

  // Ensure the source file is loaded in the project with fresh content
  try {
    await getOrCreateSourceFileWithRefresh(absoluteOldPath);
  } catch {
    throw new Error(`File not found: ${absoluteOldPath}`);
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

  return result.value;
}

export async function formatMoveFileResult(
  result: MoveFileResult,
  oldPath: string,
  newPath: string,
  root: string
): Promise<string> {
  const { message, changedFiles } = result;
  
  const output = [
    `${message}. Updated imports in ${changedFiles.length} file(s).`,
    "",
    "Changes:",
  ];
  
  // Extract the relative paths for import matching
  const oldRelativePath = path.relative(root, oldPath);
  const newRelativePath = path.relative(root, newPath);
  
  for (const file of changedFiles) {
    if (file === oldPath) {
      // This is the moved file itself
      output.push(`  File moved: ${oldRelativePath} → ${newRelativePath}`);
      continue;
    }
    
    const relativePath = path.relative(root, file);
    output.push(`  ${relativePath}:`);
    
    try {
      // Read the current file content to show import changes
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');
      
      // Find lines with import statements that reference the moved file
      let foundChanges = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;
        
        // Look for import statements that might reference the moved file
        const importRegex = /(?:import|from|require)\s*\(?['"`]([^'"`]+)['"`]\)?/g;
        let match;
        
        while ((match = importRegex.exec(line)) !== null) {
          const importPath = match[1];
          
          // Check if this import path references the new location
          // We need to handle relative imports properly
          const fileDir = path.dirname(file);
          const resolvedNewPath = path.resolve(fileDir, importPath);
          const normalizedNewPath = path.normalize(newPath);
          
          // Check if the resolved import path matches our new file path
          if (resolvedNewPath === normalizedNewPath || importPath.includes(path.basename(newPath, path.extname(newPath)))) {
            // Calculate what the old import path would have been
            const relativeOldPath = path.relative(fileDir, oldPath).replace(/\\/g, '/');
            
            // Construct the old line
            const oldLine = line.replace(importPath, relativeOldPath.startsWith('.') ? relativeOldPath : './' + relativeOldPath);
            
            if (oldLine !== line) {
              output.push(`    @@ -${lineNum},1 +${lineNum},1 @@`);
              output.push(`    - ${oldLine}`);
              output.push(`    + ${line}`);
              foundChanges = true;
            }
          }
        }
      }
      
      if (!foundChanges) {
        // If we couldn't detect specific changes, show a generic message
        output.push(`    Import statements updated`);
      }
    } catch {
      // Fallback to simple format if file reading fails
      output.push(`    Import statements updated`);
    }
  }
  
  return output.join("\n");
}

export const moveFileTool: ToolDef<typeof schema> = {
  name: "move_file",
  description:
    "Move a TypeScript/JavaScript file to a new location and update all import statements",
  schema,
  handler: async (args) => {
    const result = await handleMoveFile(args);
    const absoluteOldPath = path.join(args.root, args.oldPath);
    const absoluteNewPath = path.join(args.root, args.newPath);
    return await formatMoveFileResult(result, absoluteOldPath, absoluteNewPath, args.root);
  },
};