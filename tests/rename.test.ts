import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createProject,
  renameSymbol,
  addSourceFile,
} from "../src/renameSymbol";
import fs from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

const FIXTURES_DIR = path.join(__dirname, "fixtures/00-rename");

describe("rename", () => {
  let tmpDir: string;

  beforeEach(async () => {
    // Create temporary directory with random hash
    const hash = randomBytes(8).toString("hex");
    tmpDir = path.join(FIXTURES_DIR, `tmp-${hash}`);
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup tmp directory
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  // Convention: all test fixtures rename foo -> bar (or Foo -> Bar for classes)
  const testCases = ["simple-variable", "function", "class"];

  testCases.forEach((testName) => {
    it(`should rename ${testName}`, async () => {
      // Copy input file to tmp directory
      const inputFile = path.join(FIXTURES_DIR, `${testName}.input.ts`);
      const tmpFile = path.join(tmpDir, `${testName}.ts`);
      await fs.copyFile(inputFile, tmpFile);

      // Create project and run rename
      const project = createProject();
      addSourceFile(project, tmpFile);

      // Convention: rename at line 1, foo->bar (or Foo->Bar for class)
      const isClass = testName === "class";
      const result = await renameSymbol(project, {
        filePath: tmpFile,
        line: 1,
        symbolName: isClass ? "Foo" : "foo",
        newName: isClass ? "Bar" : "bar",
        renameInComments: true,
        renameInStrings: true,
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // Compare with expected output
      const actualContent = await fs.readFile(tmpFile, "utf-8");
      const expectedFile = path.join(FIXTURES_DIR, `${testName}.expected.ts`);
      const expectedContent = await fs.readFile(expectedFile, "utf-8");

      expect(actualContent.trim()).toBe(expectedContent.trim());
    });
  });

  describe("multi-step execution", () => {
    it("should rename multiple symbols in consolidated file", async () => {
      // Copy consolidated input file to tmp directory
      const inputFile = path.join(FIXTURES_DIR, "consolidated.input.ts");
      const tmpFile = path.join(tmpDir, "consolidated.ts");
      await fs.copyFile(inputFile, tmpFile);

      // Create project
      const project = createProject();
      addSourceFile(project, tmpFile);

      // Execute multiple rename operations
      const operations = [
        { line: 2, symbolName: "foo", newName: "bar" },
        { line: 8, symbolName: "foo2", newName: "bar2" },
        { line: 18, symbolName: "Foo3", newName: "Bar3" },
      ];

      for (const op of operations) {
        const result = await renameSymbol(project, {
          filePath: tmpFile,
          line: op.line,
          symbolName: op.symbolName,
          newName: op.newName,
          renameInComments: true,
          renameInStrings: true,
        });

        expect(result.success).toBe(true);
        expect(result.error).toBeUndefined();
      }

      // Compare with expected output
      const actualContent = await fs.readFile(tmpFile, "utf-8");
      const expectedFile = path.join(FIXTURES_DIR, "consolidated.expected.ts");
      const expectedContent = await fs.readFile(expectedFile, "utf-8");

      expect(actualContent.trim()).toBe(expectedContent.trim());
    });
  });
});
