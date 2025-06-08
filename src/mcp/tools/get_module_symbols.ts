import { z } from "zod";
import path from "path";
import { getModuleSymbols } from "../../navigations/get_module_symbols.ts";
import { findProjectForFile } from "../../utils/project_cache.ts";
import type { ToolDef } from "../types.ts";

const schema = z.object({
  moduleName: z
    .string()
    .describe("The module to analyze (e.g., 'neverthrow', './local-module')"),
  root: z.string().describe("Root directory for resolving relative paths"),
  filePath: z
    .string()
    .optional()
    .describe("Context file for resolving relative imports"),
});

type Params = z.infer<typeof schema>;

export const getModuleSymbolsTool: ToolDef<Params, Params> = {
  name: "get_module_symbols",
  description:
    "Get all exported symbols from a TypeScript/JavaScript module without detailed signatures",
  schema,
  handler: async ({ moduleName, root, filePath }) => {
    const project = await findProjectForFile(
      filePath ? path.join(root, filePath) : root
    );

    // Get module symbols
    const result = getModuleSymbols(project, {
      moduleName,
      filePath: filePath ? path.join(root, filePath) : undefined,
    });

    if (result.isErr()) {
      throw new Error(result.error);
    }

    const { message, symbols } = result.value;

    // Format the output
    const output = [message, ""];

    // Add symbols by category
    if (symbols.types.length > 0) {
      output.push(`📋 Types: ${symbols.types.map((s) => s.name).join(", ")}`);
    }
    if (symbols.interfaces.length > 0) {
      output.push(
        `📐 Interfaces: ${symbols.interfaces.map((s) => s.name).join(", ")}`
      );
    }
    if (symbols.classes.length > 0) {
      output.push(
        `🏗️ Classes: ${symbols.classes.map((s) => s.name).join(", ")}`
      );
    }
    if (symbols.functions.length > 0) {
      output.push(
        `⚡ Functions: ${symbols.functions.map((s) => s.name).join(", ")}`
      );
    }
    if (symbols.variables.length > 0) {
      output.push(
        `📦 Variables: ${symbols.variables.map((s) => s.name).join(", ")}`
      );
    }
    if (symbols.others.length > 0) {
      output.push(`❓ Others: ${symbols.others.map((s) => s.name).join(", ")}`);
    }

    return output.join("\n");
  },
};
