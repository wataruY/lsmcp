import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ProcessPool } from "./process_pool.ts";

describe("ProcessPool", () => {
  let pool: ProcessPool;

  beforeEach(() => {
    pool = new ProcessPool({
      command: "node",
      args: ["-e", "process.stdin.resume()"], // Keep process alive
      maxProcesses: 2,
      idleTimeout: 1000, // 1 second for testing
    });
  });

  afterEach(async () => {
    await pool.shutdown();
  });

  it("should create processes on demand", async () => {
    const stats1 = pool.getStats();
    expect(stats1.total).toBe(0);

    const process1 = await pool.acquire();
    expect(process1).toBeDefined();
    expect(process1.process).toBeDefined();
    expect(process1.inUse).toBe(true);

    const stats2 = pool.getStats();
    expect(stats2.total).toBe(1);
    expect(stats2.inUse).toBe(1);
    expect(stats2.idle).toBe(0);
  });

  it("should reuse released processes", async () => {
    const process1 = await pool.acquire();
    const id1 = process1.id;
    
    pool.release(id1);
    
    const stats = pool.getStats();
    expect(stats.idle).toBe(1);
    expect(stats.inUse).toBe(0);
    
    const process2 = await pool.acquire();
    expect(process2.id).toBe(id1); // Should reuse the same process
  });

  it("should respect max processes limit", async () => {
    // Acquire max processes
    const process1 = await pool.acquire();
    const process2 = await pool.acquire();
    
    // Try to acquire one more (should wait)
    let acquired = false;
    const acquirePromise = pool.acquire().then(() => {
      acquired = true;
    });
    
    // Wait a bit to ensure it's waiting
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(acquired).toBe(false);
    
    // Release one process
    pool.release(process1.id);
    
    // Now it should acquire
    await acquirePromise;
    expect(acquired).toBe(true);
  });

  it("should clean up idle processes", async () => {
    const process1 = await pool.acquire();
    pool.release(process1.id);
    
    expect(pool.getStats().total).toBe(1);
    
    // Wait for idle timeout
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    // Trigger cleanup manually
    pool.cleanupIdleProcesses();
    
    // Process should be cleaned up
    expect(pool.getStats().total).toBe(0);
  });

  it("should handle process crashes", async () => {
    const crashPool = new ProcessPool({
      command: "node",
      args: ["-e", "setTimeout(() => process.exit(1), 100)"], // Exit after 100ms
      maxProcesses: 1,
    });
    
    const process1 = await crashPool.acquire();
    
    // Wait for process to crash
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Pool should remove the crashed process
    expect(crashPool.getStats().total).toBe(0);
    
    await crashPool.shutdown();
  });
});