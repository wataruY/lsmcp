import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    "typescript-mcp": "src/mcp/typescript-mcp.ts",
    "lsp-mcp": "src/mcp/lsp-mcp.ts",
  },
});
