import { z } from "zod";
import type { ToolDef } from "../mcp/types.ts";
import {
  setupPooledLSPRequest,
  type LSPToolRequest,
} from "./lsp_common_pooled.ts";
import type { Hover } from "vscode-languageserver-types";

const schema = z.object({
  root: z.string().describe("Root directory for resolving relative paths"),
  filePath: z
    .string()
    .describe("File path containing the symbol (relative to root)"),
  line: z
    .union([z.number(), z.string()])
    .describe("Line number (1-based) or string to match in the line"),
  symbolName: z
    .string()
    .describe("Name of the symbol to get hover information for"),
  useTsgo: z
    .boolean()
    .describe("Use tsgo instead of TypeScript Language Server")
    .default(false),
});

type GetHoverPooledRequest = z.infer<typeof schema>;

/**
 * Get hover information for a TypeScript symbol using pooled LSP
 */
export const experimentalGetHoverPooledTool: ToolDef<typeof schema> = {
  name: "experimental_get_hover_pooled",
  description:
    "Get hover information (type signature, documentation) for a TypeScript symbol using pooled LSP",
  schema,
  handler: async (request: GetHoverPooledRequest) => {
    const setupResult = await setupPooledLSPRequest(
      request,
      request.useTsgo ? "tsgo" : "typescript"
    );
    
    if ("error" in setupResult) {
      return `Error: ${setupResult.error}`;
    }

    const { pool, fileUri, targetLine, symbolPosition } = setupResult.setup;

    try {
      // Get hover information using the pooled client
      const hover = await pool.getHover(fileUri, {
        line: targetLine,
        character: symbolPosition,
      });

      if (!hover) {
        return "No hover information available";
      }

      // Format the hover result
      const typedHover = hover as Hover;
      const messages: string[] = [];

      if (typedHover.contents) {
        if (typeof typedHover.contents === "string") {
          messages.push(typedHover.contents);
        } else if ("value" in typedHover.contents) {
          messages.push(typedHover.contents.value);
        } else if (Array.isArray(typedHover.contents)) {
          for (const content of typedHover.contents) {
            if (typeof content === "string") {
              messages.push(content);
            } else if ("value" in content) {
              messages.push(content.value);
            }
          }
        }
      }

      if (messages.length === 0) {
        return "Hover found but no content available";
      }

      return messages.join("\n\n");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `Error: Failed to get hover: ${errorMessage}`;
    }
  },
};