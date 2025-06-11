import { PooledLSPClient } from "./pooled_lsp_client.ts";

/**
 * Singleton manager for LSP client pools
 */
export class LSPPoolManager {
  private static instance: LSPPoolManager;
  private pools: Map<string, PooledLSPClient> = new Map();

  private constructor() {}

  static getInstance(): LSPPoolManager {
    if (!LSPPoolManager.instance) {
      LSPPoolManager.instance = new LSPPoolManager();
    }
    return LSPPoolManager.instance;
  }

  /**
   * Get or create a TypeScript LSP client pool
   */
  getTypeScriptPool(rootPath: string): PooledLSPClient {
    const key = `typescript:${rootPath}`;
    
    if (!this.pools.has(key)) {
      const pool = new PooledLSPClient({
        rootPath,
        command: "npx",
        args: ["typescript-language-server", "--stdio"],
        languageId: "typescript",
        maxProcesses: 3,
        idleTimeout: 5 * 60 * 1000, // 5 minutes
      });
      this.pools.set(key, pool);
    }
    
    return this.pools.get(key)!;
  }

  /**
   * Get or create a tsgo LSP client pool
   * tsgo is accessed via @typescript/native-preview npm package
   */
  getTsgoPool(rootPath: string): PooledLSPClient {
    const key = `tsgo:${rootPath}`;
    
    if (!this.pools.has(key)) {
      const pool = new PooledLSPClient({
        rootPath,
        command: "npx",
        args: ["@typescript/native-preview", "lsp"],
        languageId: "typescript",
        maxProcesses: 3,
        idleTimeout: 5 * 60 * 1000, // 5 minutes
      });
      this.pools.set(key, pool);
    }
    
    return this.pools.get(key)!;
  }

  /**
   * Get statistics for all pools
   */
  getAllStats(): Record<string, ReturnType<PooledLSPClient["getStats"]>> {
    const stats: Record<string, ReturnType<PooledLSPClient["getStats"]>> = {};
    
    for (const [key, pool] of this.pools) {
      stats[key] = pool.getStats();
    }
    
    return stats;
  }

  /**
   * Shutdown a specific pool
   */
  async shutdownPool(type: "typescript" | "tsgo", rootPath: string): Promise<void> {
    const key = `${type}:${rootPath}`;
    const pool = this.pools.get(key);
    
    if (pool) {
      await pool.shutdown();
      this.pools.delete(key);
    }
  }

  /**
   * Shutdown all pools
   */
  async shutdownAll(): Promise<void> {
    const shutdownPromises: Promise<void>[] = [];
    
    for (const pool of this.pools.values()) {
      shutdownPromises.push(pool.shutdown());
    }
    
    await Promise.all(shutdownPromises);
    this.pools.clear();
  }
}