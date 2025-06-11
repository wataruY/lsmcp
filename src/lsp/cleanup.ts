import { LSPPoolManager } from "./lsp_pool_manager.ts";

let cleanupRegistered = false;

/**
 * Register cleanup handlers to ensure all LSP processes are terminated on exit
 */
export function registerCleanupHandlers(): void {
  if (cleanupRegistered) {
    return;
  }

  cleanupRegistered = true;
  const manager = LSPPoolManager.getInstance();

  const cleanup = async () => {
    console.error("Shutting down LSP pools...");
    try {
      await manager.shutdownAll();
      console.error("LSP pools shut down successfully");
    } catch (error) {
      console.error("Error shutting down LSP pools:", error);
    }
  };

  // Handle various exit scenarios
  process.on("exit", () => {
    // Synchronous cleanup if possible
    cleanup().catch(() => {});
  });

  process.on("SIGINT", async () => {
    await cleanup();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await cleanup();
    process.exit(0);
  });

  process.on("uncaughtException", async (error) => {
    console.error("Uncaught exception:", error);
    await cleanup();
    process.exit(1);
  });

  process.on("unhandledRejection", async (reason) => {
    console.error("Unhandled rejection:", reason);
    await cleanup();
    process.exit(1);
  });
}
