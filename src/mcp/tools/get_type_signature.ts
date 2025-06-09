import { z } from "zod";
import path from "path";
import { getTypeSignature } from "../../navigations/get_type_signature.ts";
import { findProjectForFile } from "../../utils/project_cache.ts";
import { formatTypeSignature } from "../signature_formatter.ts";
import type { ToolDef } from "../types.ts";

const schema = z.object({
  moduleName: z
    .string()
    .describe("The module containing the type (e.g., 'neverthrow', './utils')"),
  typeName: z.string().describe("The name of the type to analyze"),
  root: z.string().describe("Root directory for resolving relative paths"),
  filePath: z
    .string()
    .optional()
    .describe("Context file for resolving relative imports"),
});

export const getTypeSignatureTool: ToolDef<typeof schema> = {
  name: "get_type_signature",
  description:
    "Get detailed signature information for a specific type (function, class, interface, type alias, etc.)",
  schema,
  handler: async ({ moduleName, typeName, root, filePath }) => {
    const project = await findProjectForFile(
      filePath ? path.join(root, filePath) : root
    );

    // Get type signature
    const result = getTypeSignature(project, {
      moduleName,
      typeName,
      filePath: filePath ? path.join(root, filePath) : undefined,
    });

    if (result.isErr()) {
      throw new Error(result.error);
    }

    const { message, signature, documentation, relatedTypes } = result.value;

    return formatTypeSignature({
      message,
      signature,
      documentation,
      relatedTypes,
      root,
    });
  },
};