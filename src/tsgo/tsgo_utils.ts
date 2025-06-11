import { spawn, ChildProcess } from "child_process";

/**
 * Spawn a tsgo LSP server process
 * tsgo is a TypeScript implementation written in Go
 */
export function spawnTsgoLSP(rootPath: string): ChildProcess {
  // For @typescript/native-preview, we should use npx to run it
  // as it's a npm package that provides the tsgo binary
  const tsgoProcess = spawn("npx", ["@typescript/native-preview", "lsp"], {
    cwd: rootPath,
    stdio: ["pipe", "pipe", "pipe"],
  });

  return tsgoProcess;
}

/**
 * Check if tsgo is installed by checking for @typescript/native-preview package
 */
export function checkTsgoInstalled(): boolean {
  try {
    // Use import.meta.resolve to check if @typescript/native-preview is available
    // import.meta.resolve returns a string synchronously in Node.js
    import.meta.resolve("@typescript/native-preview");
    return true;
  } catch {
    return false;
  }
}

/**
 * Get tsgo version
 */
export async function getTsgoVersion(): Promise<string | null> {
  try {
    // Check if package is installed first
    const isInstalled = checkTsgoInstalled();
    if (!isInstalled) {
      return null;
    }

    return await new Promise<string | null>((resolve) => {
      let output = "";
      const proc = spawn("npx", ["@typescript/native-preview", "version"], {
        stdio: ["ignore", "pipe", "ignore"],
      });

      proc.stdout.on("data", (data: Buffer) => {
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
  } catch {
    return null;
  }
}
