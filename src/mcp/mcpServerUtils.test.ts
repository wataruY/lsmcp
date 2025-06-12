import { describe, it, expect } from "vitest";
import { toMcpToolHandler } from "./mcpServerUtils.ts";

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
