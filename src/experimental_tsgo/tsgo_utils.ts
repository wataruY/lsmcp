import { spawn, ChildProcess } from "child_process";

/**
 * Spawn a tsgo LSP server process
 * tsgo is a TypeScript implementation written in Go
 */
export function spawnTsgoLSP(rootPath: string): ChildProcess {
  // Start tsgo language server
  // tsgo is assumed to be installed and available in PATH
  const tsgoProcess = spawn("tsgo", ["lsp"], {
    cwd: rootPath,
    stdio: ["pipe", "pipe", "pipe"],
  });

  return tsgoProcess;
}

/**
 * Check if tsgo is installed
 */
export async function checkTsgoInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("tsgo", ["version"], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    
    proc.on("error", () => {
      resolve(false);
    });
    
    proc.on("exit", (code) => {
      resolve(code === 0);
    });
  });
}

/**
 * Get tsgo version
 */
export async function getTsgoVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    let output = "";
    const proc = spawn("tsgo", ["version"], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    
    proc.stdout?.on("data", (data) => {
      output += data.toString();
    });
    
    proc.on("error", () => {
      resolve(null);
    });
    
    proc.on("exit", (code) => {
      if (code === 0) {
        resolve(output.trim());
      } else {
        resolve(null);
      }
    });
  });
}