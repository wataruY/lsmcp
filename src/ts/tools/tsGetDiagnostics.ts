import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import { getDiagnostics } from "../navigations/getDiagnostics";
import {
  findProjectForFile,
  getOrCreateSourceFileWithRefresh,
} from "../projectCache";
import type { ToolDef } from "../../mcp/types";

const schema = z.object({
  root: z.string().describe("Root directory for resolving relative paths"),
  filePath: z
    .string()
    .describe("File path to check for diagnostics (relative to root)"),
  virtualContent: z
    .string()
    .optional()
    .describe("Virtual content to use for diagnostics instead of file content"),
});

export interface GetDiagnosticsResult {
  message: string;
}

export async function handleGetDiagnostics({
  root,
  filePath,
  virtualContent,
}: z.infer<typeof schema>): Promise<GetDiagnosticsResult> {
  // Always treat paths as relative to root
  const absolutePath = path.join(root, filePath);

  // Check if file exists
  await fs.access(absolutePath);

  const project = findProjectForFile(absolutePath);

  // Ensure the source file is loaded in the project with fresh content
  const sourceFile = getOrCreateSourceFileWithRefresh(absolutePath);

  let originalContent: string | undefined;

  try {
    // If virtual content is provided, temporarily replace the file content
    if (virtualContent !== undefined) {
      originalContent = sourceFile.getFullText();
      sourceFile.replaceWithText(virtualContent);
    }

    // Get diagnostics
    const result = getDiagnostics(project, {
      filePaths: [absolutePath],
    });

    if (result.isErr()) {
      throw new Error(result.error);
    }

    return result.value;
  } finally {
    // Restore original content if it was replaced
    if (originalContent !== undefined) {
      sourceFile.replaceWithText(originalContent);
    }
  }
}

export function formatGetDiagnosticsResult(
  result: GetDiagnosticsResult
): string {
  // Return ts-morph's formatted output directly
  return result.message;
}

export const getDiagnosticsTool: ToolDef<typeof schema> = {
  name: "get_diagnostics",
  description:
    "Get TypeScript diagnostics (errors, warnings) for a single file",
  schema,
  execute: async (args) => {
    const result = await handleGetDiagnostics(args);
    return formatGetDiagnosticsResult(result);
  },
};
