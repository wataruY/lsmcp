import { z } from "zod";
import path from "path";
import { moveFile } from "../../commands/move_file.ts";
import {
  findProjectForFile,
  getOrCreateSourceFileWithRefresh,
} from "../../utils/project_cache.ts";
import type { ToolDef } from "../types.ts";

const schemaShape = {
  oldPath: z.string().describe("Current file path (relative to root)"),
  newPath: z.string().describe("New file path (relative to root)"),
  root: z.string().describe("Root directory for resolving relative paths"),
  overwrite: z
    .boolean()
    .optional()
    .default(false)
    .describe("Overwrite the destination file if it exists"),
};

const schema = z.object(schemaShape);

export const moveFileTool: ToolDef<typeof schema> = {
  name: "move_file",
  description:
    "Move a TypeScript/JavaScript file to a new location and update all import statements",
  schema,
  handler: async ({ oldPath, newPath, root, overwrite }) => {
    // Always treat paths as relative to root
    const absoluteOldPath = path.join(root, oldPath);
    const absoluteNewPath = path.join(root, newPath);

    const project = await findProjectForFile(absoluteOldPath);

    // Ensure the source file is loaded in the project with fresh content
    try {
      await getOrCreateSourceFileWithRefresh(absoluteOldPath);
    } catch (error) {
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

    const { message, changedFiles } = result.value;
    return `${message}. Updated imports in ${changedFiles.length} file(s).`;
  },
};
