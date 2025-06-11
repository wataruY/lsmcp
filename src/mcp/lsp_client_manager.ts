import { createLSPClient } from "../lsp/lsp_client.ts";
import type {
  Position,
  Location,
  Diagnostic,
} from "vscode-languageserver-types";
import { ChildProcess, spawn } from "child_process";

// Internal types - not exported
interface ManagedProcess {
  process: ChildProcess;
  inUse: boolean;
  lastUsed: number;
  id: string;
}

interface ProcessPool {
  processes: Map<string, ManagedProcess>;
  activeClients: Map<string, ReturnType<typeof createLSPClient>>;
  config: {
    command: string;
    args: string[];
    maxProcesses: number;
    idleTimeout: number;
    cwd: string;
  };
  cleanupTimer?: NodeJS.Timeout;
}

// Singleton state
const pools = new Map<string, ProcessPool>();
let cleanupInterval: NodeJS.Timeout | null = null;

// Start global cleanup interval
function startGlobalCleanup() {
  if (!cleanupInterval) {
    cleanupInterval = setInterval(() => {
      for (const pool of pools.values()) {
        cleanupIdleProcesses(pool);
      }
    }, 30000); // Check every 30 seconds
  }
}

// Clean up idle processes
function cleanupIdleProcesses(pool: ProcessPool): void {
  const now = Date.now();
  for (const [id, process] of pool.processes) {
    if (!process.inUse && now - process.lastUsed > pool.config.idleTimeout) {
      try {
        process.process.kill();
      } catch {
        // Ignore
      }
      pool.processes.delete(id);
      pool.activeClients.delete(id);
    }
  }
}

// Get or create LSP client
async function getLSPClient(
  pool: ProcessPool,
  rootPath: string,
  languageId: string
): Promise<ReturnType<typeof createLSPClient>> {
  // Try to find an idle process
  for (const [id, managedProcess] of pool.processes) {
    if (!managedProcess.inUse && managedProcess.process.exitCode === null) {
      managedProcess.inUse = true;
      managedProcess.lastUsed = Date.now();

      // Return existing client or create new one
      let client = pool.activeClients.get(id);
      if (!client) {
        client = createLSPClient({
          rootPath,
          process: managedProcess.process,
          languageId,
        });
        await client.start();
        pool.activeClients.set(id, client);
      }
      return client;
    }
  }

  // Create new process if under limit
  if (pool.processes.size < pool.config.maxProcesses) {
    const id = `proc-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 9)}`;
    const process = spawn(pool.config.command, pool.config.args, {
      cwd: pool.config.cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const managedProcess: ManagedProcess = {
      process,
      inUse: true,
      lastUsed: Date.now(),
      id,
    };

    // Clean up on exit
    process.on("exit", () => {
      pool.processes.delete(id);
      pool.activeClients.delete(id);
    });

    pool.processes.set(id, managedProcess);

    // Create client
    const client = createLSPClient({
      rootPath,
      process,
      languageId,
    });
    await client.start();
    pool.activeClients.set(id, client);

    return client;
  }

  // Wait for available process
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      void (async () => {
        for (const [id, managedProcess] of pool.processes) {
          if (
            !managedProcess.inUse &&
            managedProcess.process.exitCode === null
          ) {
            clearInterval(checkInterval);
            managedProcess.inUse = true;
            managedProcess.lastUsed = Date.now();

            let client = pool.activeClients.get(id);
            if (!client) {
              client = createLSPClient({
                rootPath,
                process: managedProcess.process,
                languageId,
              });
              await client.start();
              pool.activeClients.set(id, client);
            }
            resolve(client);
            return;
          }
        }
      })();
    }, 100);
  });
}

// Release client back to pool
function releaseClient(
  pool: ProcessPool,
  client: ReturnType<typeof createLSPClient>
): void {
  for (const [id, activeClient] of pool.activeClients) {
    if (activeClient === client) {
      const process = pool.processes.get(id);
      if (process) {
        process.inUse = false;
        process.lastUsed = Date.now();
      }
      break;
    }
  }
}

// Main public API - Simple interface taking just a project path
export interface LSPClientAPI {
  withClient: <T>(
    operation: (client: ReturnType<typeof createLSPClient>) => Promise<T>
  ) => Promise<T>;
  findReferences: (uri: string, position: Position) => Promise<Location[]>;
  getDefinition: (
    uri: string,
    position: Position
  ) => Promise<Location | Location[]>;
  getHover: (uri: string, position: Position) => Promise<unknown>;
  getDiagnostics: (uri: string) => Promise<Diagnostic[]>;
  shutdown: () => Promise<void>;
}

/**
 * Get a TypeScript LSP client for a project
 * @param projectPath Absolute path to the project
 */
export function getTypeScriptLSPClient(projectPath: string): LSPClientAPI {
  return getLSPClientForProject(projectPath, "typescript", {
    command: "npx",
    args: ["typescript-language-server", "--stdio"],
  });
}

/**
 * Get a tsgo LSP client for a project
 * @param projectPath Absolute path to the project
 */
export function getTsgoLSPClient(projectPath: string): LSPClientAPI {
  return getLSPClientForProject(projectPath, "typescript", {
    command: "npx",
    args: ["@typescript/native-preview", "lsp"],
  });
}

/**
 * Internal: Get or create LSP client for a project
 */
function getLSPClientForProject(
  projectPath: string,
  languageId: string,
  lspConfig: { command: string; args: string[] }
): LSPClientAPI {
  startGlobalCleanup();

  // Get or create pool
  const poolKey = `${lspConfig.command}:${projectPath}`;
  if (!pools.has(poolKey)) {
    pools.set(poolKey, {
      processes: new Map(),
      activeClients: new Map(),
      config: {
        command: lspConfig.command,
        args: lspConfig.args,
        maxProcesses: 3,
        idleTimeout: 5 * 60 * 1000, // 5 minutes
        cwd: projectPath,
      },
    });
  }

  const pool = pools.get(poolKey);
  if (!pool) {
    throw new Error(`Pool not found: ${poolKey}`);
  }

  // Return simple API
  return {
    async withClient<T>(
      operation: (client: ReturnType<typeof createLSPClient>) => Promise<T>
    ): Promise<T> {
      const client = await getLSPClient(pool, projectPath, languageId);
      try {
        return await operation(client);
      } finally {
        releaseClient(pool, client);
      }
    },

    async findReferences(uri: string, position: Position): Promise<Location[]> {
      const client = await getLSPClient(pool, projectPath, languageId);
      try {
        const fileContent = await readFile(uri);
        client.openDocument(uri, fileContent);
        await new Promise((resolve) => setTimeout(resolve, 500));
        return await client.findReferences(uri, position);
      } finally {
        releaseClient(pool, client);
      }
    },

    async getDefinition(
      uri: string,
      position: Position
    ): Promise<Location | Location[]> {
      const client = await getLSPClient(pool, projectPath, languageId);
      try {
        const fileContent = await readFile(uri);
        client.openDocument(uri, fileContent);
        await new Promise((resolve) => setTimeout(resolve, 500));
        return await client.getDefinition(uri, position);
      } finally {
        releaseClient(pool, client);
      }
    },

    async getHover(uri: string, position: Position): Promise<unknown> {
      const client = await getLSPClient(pool, projectPath, languageId);
      try {
        const fileContent = await readFile(uri);
        client.openDocument(uri, fileContent);
        await new Promise((resolve) => setTimeout(resolve, 500));
        return await client.getHover(uri, position);
      } finally {
        releaseClient(pool, client);
      }
    },

    async getDiagnostics(uri: string): Promise<Diagnostic[]> {
      const client = await getLSPClient(pool, projectPath, languageId);
      try {
        const fileContent = await readFile(uri);
        client.openDocument(uri, fileContent);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return client.getDiagnostics(uri);
      } finally {
        releaseClient(pool, client);
      }
    },

    async shutdown(): Promise<void> {
      const pool = pools.get(poolKey);
      if (!pool) return;

      // Stop all clients
      const stopPromises: Promise<void>[] = [];
      for (const client of pool.activeClients.values()) {
        stopPromises.push(client.stop().catch(() => {}));
      }
      await Promise.all(stopPromises);

      // Kill all processes
      for (const process of pool.processes.values()) {
        try {
          process.process.kill();
        } catch {
          // Ignore
        }
      }

      pools.delete(poolKey);
    },
  };
}

// Utility function
async function readFile(uri: string): Promise<string> {
  const fs = await import("fs/promises");
  const path = uri.replace("file://", "");
  return fs.readFile(path, "utf-8");
}

// Global shutdown
export async function shutdownAllClients(): Promise<void> {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }

  const shutdownPromises: Promise<void>[] = [];
  for (const pool of pools.values()) {
    // Stop all clients
    for (const client of pool.activeClients.values()) {
      shutdownPromises.push(client.stop().catch(() => {}));
    }
    // Kill all processes
    for (const process of pool.processes.values()) {
      try {
        process.process.kill();
      } catch {
        // Ignore
      }
    }
  }

  await Promise.all(shutdownPromises);
  pools.clear();
}

process.on("exit", () => {
  shutdownAllClients().catch(() => {});
});

process.on("SIGINT", () => {
  void (async () => {
    await shutdownAllClients();
    process.exit(0);
  })();
});

process.on("SIGTERM", () => {
  void (async () => {
    await shutdownAllClients();
    process.exit(0);
  })();
});
