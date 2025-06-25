import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    "mcp": "src/mcp/unified-mcp.ts",
    "typescript-mcp": "src/mcp/typescript-mcp.ts",
    "lsp-mcp": "src/mcp/lsp-mcp.ts",
    "moonbit-mcp": "src/mcp/moonbit-mcp.ts",
    "rust-mcp": "src/mcp/rust-mcp.ts",
    "multi-language-mcp": "src/mcp/multi-language-mcp.ts",
  },
  define: {
    "import.meta.vitest": "undefined",
  },
});
