import { Result } from "neverthrow";

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

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
 * Convert a Result-based handler to MCP tool format
 * @param handler Function that returns a Result with success message
 * @returns MCP tool handler
 */
export function resultHandler<T, S extends { message: string }>(
  handler: (args: T) => Promise<Result<S, string>> | Result<S, string>
): (args: T) => Promise<ToolResult> {
  return async (args: T) => {
    try {
      const result = await handler(args);

      if (result.isOk()) {
        return {
          content: [
            {
              type: "text",
              text: result.value.message,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${result.error}`,
            },
          ],
          isError: true,
        };
      }
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
