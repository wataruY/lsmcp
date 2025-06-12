/**
 * MCP (Model Context Protocol) library - helper functions for MCP server implementation
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDef } from "./types.ts";
import { type z, ZodObject } from "zod";

interface ToolResult {
  content: { type: "text"; text: string; [x: string]: unknown }[];
  isError?: boolean;
  [x: string]: unknown;
}

/**
 * Convert a string-returning handler to MCP response format with error handling
 * @param handler The tool handler function that returns a string message
 * @returns A wrapped handler that returns MCP ToolResult format
 */
export function toMcpToolHandler<T>(
  handler: (args: T) => Promise<string> | string
): (args: T) => Promise<ToolResult> {
  return async (args: T) => {
    try {
      const message = await handler(args);
      return {
        content: [
          {
            type: "text",
            text: message,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  };
}

/**
 * Register a tool definition with the MCP server
 */
export function registerTool<S extends z.ZodType>(
  server: McpServer,
  tool: ToolDef<S>,
  defaultRoot?: string
) {
  // Check if the schema is a ZodObject to extract shape
  if (tool.schema instanceof ZodObject) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const schemaShape = tool.schema.shape;

    // Create a wrapper handler that adds default root if not provided
    const wrappedHandler =
      defaultRoot && "root" in schemaShape
        ? (args: z.infer<S>) => {
            // If root is not provided in args, use the default
            const argsWithRoot = {
              ...args,
              root: (args as Record<string, unknown>).root || defaultRoot,
            } as z.infer<S>;
            return tool.execute(argsWithRoot);
          }
        : tool.execute;

    server.tool(
      tool.name,
      tool.description,
      schemaShape,
      toMcpToolHandler(wrappedHandler)
    );
  } else {
    // For non-ZodObject schemas, register without shape
    server.tool(tool.name, tool.description, toMcpToolHandler(tool.execute));
  }
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  describe("toMcpHandler", () => {
    it("should convert string to MCP format when no error occurs", async () => {
      const handler = toMcpToolHandler(() => {
        return "Success message";
      });

      const result = await handler({});
      expect(result).toEqual({
        content: [{ type: "text", text: "Success message" }],
      });
    });

    it("should catch and format errors", async () => {
      const handler = toMcpToolHandler(() => {
        throw new Error("Test error message");
      });

      const result = await handler({});
      expect(result).toEqual({
        content: [{ type: "text", text: "Error: Test error message" }],
        isError: true,
      });
    });

    it("should handle non-Error thrown values", async () => {
      const handler = toMcpToolHandler(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw "String error";
      });

      const result = await handler({});
      expect(result).toEqual({
        content: [{ type: "text", text: "Error: String error" }],
        isError: true,
      });
    });

    it("should work with synchronous handlers", async () => {
      const handler = toMcpToolHandler(() => {
        return "Sync result message";
      });

      const result = await handler({});
      expect(result).toEqual({
        content: [{ type: "text", text: "Sync result message" }],
      });
    });
  });
}
