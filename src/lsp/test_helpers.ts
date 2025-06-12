import { lspProcessPool, type PooledLSPClient } from "./lsp_process_pool.ts";
import { setActiveClient } from "./lsp_client.ts";

let currentPooledClient: PooledLSPClient | null = null;
let currentRoot: string | null = null;

export async function setupLSPForTest(root: string): Promise<void> {
  currentRoot = root;
  currentPooledClient = await lspProcessPool.acquire(root);
  setActiveClient(currentPooledClient.client);
}

export async function teardownLSPForTest(): Promise<void> {
  if (currentRoot && currentPooledClient) {
    await lspProcessPool.release(currentRoot);
    currentPooledClient = null;
    currentRoot = null;
    setActiveClient(null);
  }
}