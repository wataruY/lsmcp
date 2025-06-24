import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, ChildProcess } from "child_process";
import { 
  initialize as initializeLSPClient, 
  shutdown as shutdownLSPClient
} from "../src/lsp/lspClient.ts";
import { lspRenameSymbolTool } from "../src/lsp/tools/lspRenameSymbol.ts";
import fs from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

const FIXTURES_DIR = path.join(__dirname, "fixtures/lsp-rename");

describe("lsp rename symbol", () => {
  let lspProcess: ChildProcess;
  let tmpDir: string;

  beforeAll(async () => {
    // Skip test if LSP_COMMAND is not set
    if (!process.env.LSP_COMMAND) {
      console.log("Skipping LSP rename tests: LSP_COMMAND not set");
      return;
    }

    // Start TypeScript language server
    const [command, ...args] = process.env.LSP_COMMAND.split(" ");
    lspProcess = spawn(command, args, {
      cwd: __dirname,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Initialize LSP client
    await initializeLSPClient(__dirname, lspProcess, "typescript");
  });

  beforeAll(async () => {
    // Create temporary directory with random hash
    const hash = randomBytes(8).toString("hex");
    tmpDir = path.join(__dirname, `tmp-lsp-rename-${hash}`);
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterAll(async () => {
    // Cleanup
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
    
    if (lspProcess) {
      await shutdownLSPClient();
      lspProcess.kill();
    }
  });

  it("should rename a simple variable", async () => {
    if (!process.env.LSP_COMMAND) {
      return;
    }

    // Copy test file to temp directory
    const inputFile = path.join(FIXTURES_DIR, "simple-variable.input.ts");
    const testFile = path.join(tmpDir, "simple-variable.ts");
    await fs.copyFile(inputFile, testFile);

    // Execute rename
    const result = await lspRenameSymbolTool.execute({
      root: tmpDir,
      filePath: "simple-variable.ts",
      line: 1, // const foo = 1;
      target: "foo",
      newName: "bar",
    });

    // Verify result
    expect(result).toContain("Successfully renamed symbol");
    expect(result).toContain("simple-variable.ts");
    expect(result).toContain('"foo" → "bar"');

    // Verify file content
    const actualContent = await fs.readFile(testFile, "utf-8");
    const expectedFile = path.join(FIXTURES_DIR, "simple-variable.expected.ts");
    const expectedContent = await fs.readFile(expectedFile, "utf-8");
    
    expect(actualContent.trim()).toBe(expectedContent.trim());
  });

  it("should rename a function", async () => {
    if (!process.env.LSP_COMMAND) {
      return;
    }

    // Copy test file to temp directory
    const inputFile = path.join(FIXTURES_DIR, "function.input.ts");
    const testFile = path.join(tmpDir, "function.ts");
    await fs.copyFile(inputFile, testFile);

    // Execute rename
    const result = await lspRenameSymbolTool.execute({
      root: tmpDir,
      filePath: "function.ts",
      line: 1, // function foo(x: number): number {
      target: "foo",
      newName: "bar",
    });

    // Verify result
    expect(result).toContain("Successfully renamed symbol");
    expect(result).toContain("function.ts");
    expect(result).toContain('"foo" → "bar"');

    // Verify file content
    const actualContent = await fs.readFile(testFile, "utf-8");
    const expectedFile = path.join(FIXTURES_DIR, "function.expected.ts");
    const expectedContent = await fs.readFile(expectedFile, "utf-8");
    
    expect(actualContent.trim()).toBe(expectedContent.trim());
  });

  it("should rename a class", async () => {
    if (!process.env.LSP_COMMAND) {
      return;
    }

    // Copy test file to temp directory
    const inputFile = path.join(FIXTURES_DIR, "class.input.ts");
    const testFile = path.join(tmpDir, "class.ts");
    await fs.copyFile(inputFile, testFile);

    // Execute rename
    const result = await lspRenameSymbolTool.execute({
      root: tmpDir,
      filePath: "class.ts",
      line: 1, // class Foo {
      target: "Foo",
      newName: "Bar",
    });

    // Verify result
    expect(result).toContain("Successfully renamed symbol");
    expect(result).toContain("class.ts");
    expect(result).toContain('"Foo" → "Bar"');

    // Verify file content
    const actualContent = await fs.readFile(testFile, "utf-8");
    const expectedFile = path.join(FIXTURES_DIR, "class.expected.ts");
    const expectedContent = await fs.readFile(expectedFile, "utf-8");
    
    expect(actualContent.trim()).toBe(expectedContent.trim());
  });

  it("should rename without specifying line number", async () => {
    if (!process.env.LSP_COMMAND) {
      return;
    }

    // Copy test file to temp directory
    const inputFile = path.join(FIXTURES_DIR, "simple-variable.input.ts");
    const testFile = path.join(tmpDir, "simple-variable-no-line.ts");
    await fs.copyFile(inputFile, testFile);

    // Execute rename without line parameter
    const result = await lspRenameSymbolTool.execute({
      root: tmpDir,
      filePath: "simple-variable-no-line.ts",
      target: "foo",
      newName: "bar",
    });

    // Verify result
    expect(result).toContain("Successfully renamed symbol");
    expect(result).toContain("simple-variable-no-line.ts");
    expect(result).toContain('"foo" → "bar"');

    // Verify file content
    const actualContent = await fs.readFile(testFile, "utf-8");
    const expectedFile = path.join(FIXTURES_DIR, "simple-variable.expected.ts");
    const expectedContent = await fs.readFile(expectedFile, "utf-8");
    
    expect(actualContent.trim()).toBe(expectedContent.trim());
  });

  it("should handle rename errors gracefully", async () => {
    if (!process.env.LSP_COMMAND) {
      return;
    }

    // Try to rename a non-existent symbol
    await expect(
      lspRenameSymbolTool.execute({
        root: tmpDir,
        filePath: "nonexistent.ts",
        line: 1,
        target: "foo",
        newName: "bar",
      })
    ).rejects.toThrow();
  });
});