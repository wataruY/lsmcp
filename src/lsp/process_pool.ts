import { ChildProcess, spawn } from "child_process";
import { EventEmitter } from "events";

export interface PooledProcess {
  process: ChildProcess;
  inUse: boolean;
  lastUsed: number;
  id: string;
}

export interface ProcessPoolConfig {
  command: string;
  args: string[];
  maxProcesses?: number;
  idleTimeout?: number; // milliseconds before killing idle process
  cwd?: string;
}

export class ProcessPool extends EventEmitter {
  private pool: Map<string, PooledProcess> = new Map();
  private config: Required<ProcessPoolConfig>;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: ProcessPoolConfig) {
    super();
    this.config = {
      maxProcesses: config.maxProcesses || 5,
      idleTimeout: config.idleTimeout || 5 * 60 * 1000, // 5 minutes default
      command: config.command,
      args: config.args,
      cwd: config.cwd || process.cwd(),
    };

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleProcesses();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Acquire a process from the pool
   * Creates a new one if pool is not full, otherwise waits for one to be available
   */
  async acquire(): Promise<PooledProcess> {
    // Try to find an idle process
    for (const [id, pooledProcess] of this.pool) {
      if (!pooledProcess.inUse && pooledProcess.process.exitCode === null) {
        pooledProcess.inUse = true;
        pooledProcess.lastUsed = Date.now();
        return pooledProcess;
      }
    }

    // If we haven't reached max processes, create a new one
    if (this.pool.size < this.config.maxProcesses) {
      return await this.createNewProcess();
    }

    // Otherwise wait for a process to become available
    return new Promise((resolve) => {
      const checkAvailable = setInterval(() => {
        for (const [id, pooledProcess] of this.pool) {
          if (!pooledProcess.inUse && pooledProcess.process.exitCode === null) {
            clearInterval(checkAvailable);
            pooledProcess.inUse = true;
            pooledProcess.lastUsed = Date.now();
            resolve(pooledProcess);
            return;
          }
        }
      }, 100);
    });
  }

  /**
   * Release a process back to the pool
   */
  release(id: string): void {
    const pooledProcess = this.pool.get(id);
    if (pooledProcess) {
      pooledProcess.inUse = false;
      pooledProcess.lastUsed = Date.now();
    }
  }

  /**
   * Create a new process and add it to the pool
   */
  private async createNewProcess(): Promise<PooledProcess> {
    const id = `process-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const process = spawn(this.config.command, this.config.args, {
      cwd: this.config.cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const pooledProcess: PooledProcess = {
      process,
      inUse: true,
      lastUsed: Date.now(),
      id,
    };

    // Handle process exit
    process.on("exit", (code) => {
      this.emit("processExit", { id, code });
      this.pool.delete(id);
    });

    process.on("error", (error) => {
      this.emit("processError", { id, error });
      this.pool.delete(id);
    });

    this.pool.set(id, pooledProcess);
    return pooledProcess;
  }

  /**
   * Clean up idle processes that have exceeded the timeout
   */
  cleanupIdleProcesses(): void {
    const now = Date.now();
    for (const [id, pooledProcess] of this.pool) {
      if (
        !pooledProcess.inUse &&
        now - pooledProcess.lastUsed > this.config.idleTimeout
      ) {
        this.killProcess(id);
      }
    }
  }

  /**
   * Kill a specific process
   */
  private killProcess(id: string): void {
    const pooledProcess = this.pool.get(id);
    if (pooledProcess) {
      try {
        pooledProcess.process.kill();
      } catch {
        // Ignore errors during kill
      }
      this.pool.delete(id);
    }
  }

  /**
   * Shutdown all processes in the pool
   */
  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    const killPromises: Promise<void>[] = [];
    
    for (const [id, pooledProcess] of this.pool) {
      killPromises.push(
        new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            // Force kill if process doesn't exit gracefully
            try {
              pooledProcess.process.kill("SIGKILL");
            } catch {
              // Ignore
            }
            resolve();
          }, 1000);

          pooledProcess.process.once("exit", () => {
            clearTimeout(timeout);
            resolve();
          });

          try {
            pooledProcess.process.kill();
          } catch {
            clearTimeout(timeout);
            resolve();
          }
        })
      );
    }

    await Promise.all(killPromises);
    this.pool.clear();
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    total: number;
    inUse: number;
    idle: number;
  } {
    let inUse = 0;
    let idle = 0;

    for (const pooledProcess of this.pool.values()) {
      if (pooledProcess.inUse) {
        inUse++;
      } else {
        idle++;
      }
    }

    return {
      total: this.pool.size,
      inUse,
      idle,
    };
  }
}