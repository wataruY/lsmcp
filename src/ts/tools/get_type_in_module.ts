import { z } from "zod";
import path from "path";
import { getTypeSignature } from "../navigations/get_type_signature";
import { findProjectForFile } from "../project_cache";
import {
  formatTypeSignature,
  type FormatTypeSignatureInput,
} from "../../mcp/signature_formatter";
import type { ToolDef } from "../../mcp/types";

const schema = z.object({
  root: z.string().describe("Root directory for resolving relative paths"),
  moduleName: z
    .string()
    .describe("The module containing the type (e.g., 'neverthrow', './utils')"),
  typeName: z.string().describe("The name of the type to analyze"),
  filePath: z
    .string()
    .optional()
    .describe("Context file for resolving relative imports"),
});

export type GetTypeInModuleResult = FormatTypeSignatureInput;

export function handleGetTypeInModule({
  root,
  moduleName,
  typeName,
  filePath,
}: z.infer<typeof schema>): GetTypeInModuleResult {
  const project = findProjectForFile(
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

  return {
    message,
    signature,
    documentation,
    relatedTypes,
    root,
  };
}

export { formatTypeSignature as formatGetTypeInModuleResult };

export const getTypeInModuleTool: ToolDef<typeof schema> = {
  name: "get_type_in_module",
  description:
    "Get detailed signature information for a specific type (function, class, interface, type alias, etc.) from a module",
  schema,
  handler: (args) => {
    const result = handleGetTypeInModule(args);
    return Promise.resolve(formatTypeSignature(result));
  },
};
