import { z } from "zod";
import type { ToolDef } from "../../mcp/types";
import { moveDirectory } from "../commands/moveDirectory";
import { resolve } from "node:path";

const schema = z.object({
  root: z.string().optional().describe("Root directory for resolving relative paths"),
  sourcePath: z.string().describe("The relative path of the directory to move"),
  targetPath: z.string().describe("The new relative path for the directory"),
  overwrite: z
    .boolean()
    .optional()
    .describe("Whether to overwrite existing directory at target path"),
});

export const moveDirectoryTool: ToolDef<typeof schema> = {
  name: "move_directory",
  description:
    "Move a directory to a new location, updating all TypeScript imports and references automatically",
  schema,
  execute: async (input) => {
    const rootPath = input.root || process.cwd();
    const source = resolve(rootPath, input.sourcePath);
    const target = resolve(rootPath, input.targetPath);

    const result = await moveDirectory(rootPath, source, target, {
      overwrite: input.overwrite,
    });

    if (!result.success) {
      throw new Error(result.error || "Failed to move directory");
    }

    return JSON.stringify(
      {
        success: true,
        movedFiles: result.movedFiles.map((filePath) => ({
          path: filePath.replace(rootPath + "/", ""),
        })),
        message: `Successfully moved directory from ${input.sourcePath} to ${input.targetPath}. Moved ${result.movedFiles.length} files.`,
      },
      null,
      2
    );
  },
};
