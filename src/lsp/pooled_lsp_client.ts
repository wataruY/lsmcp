import { ProcessPool, type PooledProcess } from "./process_pool.ts";
import { createLSPClient, type LSPClientConfig } from "./lsp_client.ts";
import type { Position, Location, Diagnostic } from "vscode-languageserver-types";

export interface PooledLSPClientConfig {
  rootPath: string;
  command: string;
  args: string[];
  languageId?: string;
  maxProcesses?: number;
  idleTimeout?: number;
}

/**
 * Manages a pool of LSP clients for improved performance
 */
export class PooledLSPClient {
  private pool: ProcessPool;
  private config: PooledLSPClientConfig;
  private activeClients: Map<string, ReturnType<typeof createLSPClient>> = new Map();

  constructor(config: PooledLSPClientConfig) {
    this.config = config;
    this.pool = new ProcessPool({
      command: config.command,
      args: config.args,
      maxProcesses: config.maxProcesses,
      idleTimeout: config.idleTimeout,
      cwd: config.rootPath,
    });
  }

  /**
   * Execute an operation with a pooled LSP client
   */
  async withClient<T>(
    operation: (client: ReturnType<typeof createLSPClient>) => Promise<T>
  ): Promise<T> {
    const pooledProcess = await this.pool.acquire();
    
    try {
      // Check if we already have a client for this process
      let client = this.activeClients.get(pooledProcess.id);
      
      if (!client) {
        // Create new client for this process
        const clientConfig: LSPClientConfig = {
          rootPath: this.config.rootPath,
          process: pooledProcess.process,
          languageId: this.config.languageId,
        };
        
        client = createLSPClient(clientConfig);
        await client.start();
        this.activeClients.set(pooledProcess.id, client);
      }
      
      // Execute the operation
      return await operation(client);
    } finally {
      // Release the process back to the pool
      this.pool.release(pooledProcess.id);
    }
  }

  /**
   * Find references for a symbol
   */
  async findReferences(
    uri: string,
    position: Position
  ): Promise<Location[]> {
    return this.withClient(async (client) => {
      // Ensure document is open
      const fileContent = await this.readFile(uri);
      client.openDocument(uri, fileContent);
      
      // Wait a bit for LSP to process
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return client.findReferences(uri, position);
    });
  }

  /**
   * Get definition for a symbol
   */
  async getDefinition(
    uri: string,
    position: Position
  ): Promise<Location | Location[]> {
    return this.withClient(async (client) => {
      // Ensure document is open
      const fileContent = await this.readFile(uri);
      client.openDocument(uri, fileContent);
      
      // Wait a bit for LSP to process
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return client.getDefinition(uri, position);
    });
  }

  /**
   * Get hover information
   */
  async getHover(
    uri: string,
    position: Position
  ): Promise<unknown> {
    return this.withClient(async (client) => {
      // Ensure document is open
      const fileContent = await this.readFile(uri);
      client.openDocument(uri, fileContent);
      
      // Wait a bit for LSP to process
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return client.getHover(uri, position);
    });
  }

  /**
   * Get diagnostics for a file
   */
  async getDiagnostics(uri: string): Promise<Diagnostic[]> {
    return this.withClient(async (client) => {
      // Ensure document is open
      const fileContent = await this.readFile(uri);
      client.openDocument(uri, fileContent);
      
      // Wait a bit for LSP to process diagnostics
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return client.getDiagnostics(uri);
    });
  }

  /**
   * Read file content (simple implementation, can be replaced)
   */
  private async readFile(uri: string): Promise<string> {
    const fs = await import("fs/promises");
    const path = uri.replace("file://", "");
    return fs.readFile(path, "utf-8");
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return this.pool.getStats();
  }

  /**
   * Shutdown the pool and all clients
   */
  async shutdown(): Promise<void> {
    // Stop all active clients
    const stopPromises: Promise<void>[] = [];
    for (const client of this.activeClients.values()) {
      stopPromises.push(client.stop().catch(() => {}));
    }
    await Promise.all(stopPromises);
    
    this.activeClients.clear();
    
    // Shutdown the process pool
    await this.pool.shutdown();
  }
}