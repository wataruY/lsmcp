// @ts-nocheck
/**
 * TypeScript support for DAP debugging using ts-blank-space
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { createHash } from "crypto";
import ts from "typescript";
import { blankSourceFile } from "ts-blank-space";

/**
 * Transform TypeScript code to JavaScript using ts-blank-space
 */
export function transformTypeScript(code: string, fileName: string): string {
  const sourceFile = ts.createSourceFile(
    fileName,
    code,
    ts.ScriptTarget.Latest,
    true
  );
  
  return blankSourceFile(sourceFile, code);
}

/**
 * Create a temporary JavaScript file from TypeScript source
 */
export function createTempJsFile(tsFilePath: string): string {
  const code = fs.readFileSync(tsFilePath, "utf-8");
  const transformed = transformTypeScript(code, tsFilePath);
  
  // Create a deterministic temp file name based on source path
  const hash = createHash("md5").update(tsFilePath).digest("hex").slice(0, 8);
  const basename = path.basename(tsFilePath, ".ts");
  const tempFileName = `${basename}-${hash}.js`;
  const tempFilePath = path.join(os.tmpdir(), "dap-ts-debug", tempFileName);
  
  // Ensure temp directory exists
  const tempDir = path.dirname(tempFilePath);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // Write transformed code
  fs.writeFileSync(tempFilePath, transformed, "utf-8");
  
  return tempFilePath;
}

/**
 * Clean up temporary files created for debugging
 */
export function cleanupTempFiles(): void {
  const tempDir = path.join(os.tmpdir(), "dap-ts-debug");
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Map a JavaScript file path back to its TypeScript source
 */
export function mapJsToTsPath(jsPath: string): string | null {
  // Check if it's a temp file we created
  const tempDir = path.join(os.tmpdir(), "dap-ts-debug");
  if (jsPath.startsWith(tempDir)) {
    // Extract original filename from temp file name
    const basename = path.basename(jsPath, ".js");
    const parts = basename.split("-");
    parts.pop(); // Remove hash
    const originalBasename = parts.join("-");
    
    // This is a simplified mapping - in practice, we'd need to maintain
    // a proper mapping of temp files to source files
    return null;
  }
  
  return null;
}

/**
 * Check if a file is TypeScript
 */
export function isTypeScriptFile(filePath: string): boolean {
  return filePath.endsWith(".ts") || filePath.endsWith(".tsx");
}

/**
 * TODO: Add support for other languages with DAP support
 * 
 * Languages to consider:
 * - Python (debugpy)
 * - Go (dlv)
 * - Rust (rust-analyzer or lldb)
 * - C/C++ (gdb, lldb)
 * - Java (java-debug)
 * - Ruby (ruby-debug-ide)
 * - PHP (xdebug)
 * - C# (.NET Core debugger)
 * 
 * Each language would need:
 * 1. Detection logic (file extension, project files)
 * 2. Adapter resolution (find/install appropriate DAP adapter)
 * 3. Launch configuration generation
 * 4. Language-specific features (e.g., virtual environments for Python)
 */