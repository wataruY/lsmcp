import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDef } from "./types.ts";
import { type z } from "zod";

interface ToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
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
export function registerTool(server: McpServer, tool: ToolDef<any>) {
  // Extract the shape from the ZodObject schema
  const schemaShape = (tool.schema as z.ZodObject<any>).shape;
  
  server.tool(
    tool.name,
    tool.description,
    schemaShape,
    toMcpToolHandler(tool.handler)
  );
}
