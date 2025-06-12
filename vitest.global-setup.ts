import { lspProcessPool } from "./src/lsp/lspProcessPool.ts";

export function setup() {
  // Pre-warm the LSP process pool can be done here if needed
  console.log("Global setup: LSP process pool ready");
}

export async function teardown() {
  console.log("Global teardown: Shutting down LSP process pool");
  await lspProcessPool.shutdown();
}