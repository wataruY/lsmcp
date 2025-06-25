import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    "typescript-mcp": "src/mcp/typescript-mcp.ts",
    "lsmcp": "src/mcp/unified-mcp.ts",
    "generic-lsp-mcp": "src/mcp/generic-lsp-mcp.ts",
    "moonbit-mcp": "src/mcp/moonbit-mcp.ts",
    "rust-mcp": "src/mcp/rust-mcp.ts",
    "multi-language-mcp": "src/mcp/multi-language-mcp.ts",
  },
  define: {
    "import.meta.vitest": "undefined",
  },
});
