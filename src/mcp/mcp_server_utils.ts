import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDef } from "./types.ts";
import { type z } from "zod";

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
export function registerTool(server: McpServer, tool: ToolDef<any>, defaultRoot?: string) {
  // Extract the shape from the ZodObject schema
  const schemaShape = (tool.schema as z.ZodObject<any>).shape;
  
  // Create a wrapper handler that adds default root if not provided
  const wrappedHandler = defaultRoot && schemaShape.root ? 
    (args: any) => {
      // If root is not provided in args, use the default
      const argsWithRoot = {
        ...args,
        root: args.root || defaultRoot
      };
      return tool.execute(argsWithRoot);
    } : 
    tool.execute;
  
  server.tool(
    tool.name,
    tool.description,
    schemaShape,
    toMcpToolHandler(wrappedHandler)
  );
}
