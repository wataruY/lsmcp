import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    "lsmcp": "src/mcp/lsmcp.ts",
    "typescript-mcp": "src/mcp/typescript-mcp.ts",
    "generic-lsp-mcp": "src/mcp/generic-lsp-mcp.ts",
    "dap-mcp": "src/dap/dap-mcp.ts",
    "node-dap-adapter": "src/dap/adapters/node-dap-adapter.ts",
    "minimal-adapter": "src/dap/minimal-adapter.ts",
    "debug-adapter": "src/dap/debug-adapter.ts",
    "simple-debug-mcp": "src/mcp/simple-debug-mcp.ts",
  },
  define: {
    "import.meta.vitest": "undefined",
  },
});
