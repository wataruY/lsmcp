import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    "lsmcp": "src/mcp/unified-mcp.ts",
    "typescript-mcp": "src/mcp/typescript-mcp.ts",
  },
  define: {
    "import.meta.vitest": "undefined",
  },
});
