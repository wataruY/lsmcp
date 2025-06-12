import { z } from "zod";
import path from "path";
import { getModuleSymbols } from "../navigations/getModuleSymbols";
import { findProjectForFile } from "../projectCache";
import type { ToolDef } from "../../mcp/types";

const schema = z.object({
  root: z.string().describe("Root directory for resolving relative paths"),
  moduleName: z
    .string()
    .describe("The module to analyze (e.g., 'neverthrow', './local-module')"),
  filePath: z
    .string()
    .optional()
    .describe("Context file for resolving relative imports"),
});

export interface ModuleSymbol {
  name: string;
  kind: string;
}

export interface GetModuleSymbolsResult {
  message: string;
  symbols: {
    types: ModuleSymbol[];
    interfaces: ModuleSymbol[];
    classes: ModuleSymbol[];
    functions: ModuleSymbol[];
    variables: ModuleSymbol[];
    others: ModuleSymbol[];
  };
}

export function handleGetModuleSymbols({
  root,
  moduleName,
  filePath,
}: z.infer<typeof schema>): GetModuleSymbolsResult {
  const project = findProjectForFile(
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

  return result.value;
}

export function formatGetModuleSymbolsResult(
  result: GetModuleSymbolsResult
): string {
  const { message, symbols } = result;

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
    output.push(`🏗️ Classes: ${symbols.classes.map((s) => s.name).join(", ")}`);
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
}

export const getModuleSymbolsTool: ToolDef<typeof schema> = {
  name: "get_module_symbols",
  description:
    "Get all exported symbols from a TypeScript/JavaScript module without detailed signatures",
  schema,
  execute: (args) => {
    const result = handleGetModuleSymbols(args);
    return Promise.resolve(formatGetModuleSymbolsResult(result));
  },
};
