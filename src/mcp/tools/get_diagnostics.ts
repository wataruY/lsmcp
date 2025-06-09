import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import { getDiagnostics } from "../../navigations/get_diagnostics.ts";
import {
  findProjectForFile,
  getOrCreateSourceFileWithRefresh,
} from "../../utils/project_cache.ts";
import type { ToolDef } from "../types.ts";

const schema = z.object({
  filePath: z
    .string()
    .describe("File path to check for diagnostics (relative to root)"),
  root: z.string().describe("Root directory for resolving relative paths"),
});

export const getDiagnosticsTool: ToolDef<typeof schema> = {
  name: "get_diagnostics",
  description:
    "Get TypeScript diagnostics (errors, warnings) for a single file",
  schema,
  handler: async ({ filePath, root }) => {
    // Always treat paths as relative to root
    const absolutePath = path.join(root, filePath);

    // Check if file exists
    await fs.access(absolutePath);

    const project = await findProjectForFile(absolutePath);

    // Ensure the source file is loaded in the project with fresh content
    await getOrCreateSourceFileWithRefresh(absolutePath);

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
  },
};
