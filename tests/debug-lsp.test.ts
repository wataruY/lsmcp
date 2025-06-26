import { describe, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs/promises";
import { randomBytes } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GENERIC_LSP_MCP_PATH = path.join(__dirname, "../dist/generic-lsp-mcp.js");

describe("Debug LSP", () => {
  it("should debug LSP hover", async () => {
    const hash = randomBytes(8).toString("hex");
    const tmpDir = path.join(__dirname, `tmp-debug-${hash}`);
    await fs.mkdir(tmpDir, { recursive: true });

    // Create a TypeScript project
    await fs.writeFile(path.join(tmpDir, "tsconfig.json"), JSON.stringify({
      compilerOptions: {
        target: "es2020",
        module: "commonjs",
        strict: true,
      }
    }, null, 2));

    // Create a simple TypeScript file
    const tsCode = `const message: string = "Hello";`;
    await fs.writeFile(path.join(tmpDir, "test.ts"), tsCode);

    // Create transport with server parameters
    const transport = new StdioClientTransport({
      command: "node",
      args: [GENERIC_LSP_MCP_PATH],
      env: {
        ...process.env,
        PROJECT_ROOT: tmpDir,
        LSP_COMMAND: "npx typescript-language-server --stdio",
        DEBUG: "true",
      } as Record<string, string>,
    });

    // Create and connect client
    const client = new Client({
      name: "test-client",
      version: "1.0.0",
    });

    console.log("Connecting to MCP server...");
    await client.connect(transport);
    console.log("Connected!");

    // List tools
    console.log("Listing tools...");
    const toolsResponse = await client.listTools();
    console.log("Tools:", toolsResponse.tools.map(t => t.name));

    // Call hover tool
    console.log("Calling lsp_get_hover...");
    try {
      const result = await client.callTool({
        name: "lsp_get_hover",
        arguments: {
          root: tmpDir,
          filePath: "test.ts",
          line: 1,
          target: "message",
        },
      });
      console.log("Result:", result);
      
      if (result.isError) {
        console.error("Tool returned error:", result.content);
      } else {
        console.log("Tool returned success:", result.content);
      }
    } catch (error) {
      console.error("Error calling tool:", error);
    }

    // Cleanup
    await client.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });
});