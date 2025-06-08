import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createProject, rename, addSourceFile } from "../src/rename";
import fs from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

const FIXTURES_DIR = path.join(__dirname, "__fixtures/00-rename");

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

  const config = {
    "simple-variable": {
      line: 1,
      symbolName: "foo",
      newName: "bar",
    },
    function: {
      line: 1,
      symbolName: "foo",
      newName: "bar",
    },
    class: {
      line: 1,
      symbolName: "Foo",
      newName: "Bar",
    },
  };

  Object.entries(config).forEach(([testName, testConfig]) => {
    it(`should rename ${testName}`, async () => {
      // Copy input file to tmp directory
      const inputFile = path.join(FIXTURES_DIR, `input-${testName}.ts`);
      const tmpFile = path.join(tmpDir, `${testName}.ts`);
      await fs.copyFile(inputFile, tmpFile);

      // Create project and run rename
      const project = createProject();
      addSourceFile(project, tmpFile);

      const result = await rename(project, {
        filePath: tmpFile,
        line: testConfig.line,
        symbolName: testConfig.symbolName,
        newName: testConfig.newName,
        renameInComments: true,
        renameInStrings: true,
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // Compare with expected output
      const actualContent = await fs.readFile(tmpFile, "utf-8");
      const expectedFile = path.join(FIXTURES_DIR, `expect-${testName}.ts`);
      const expectedContent = await fs.readFile(expectedFile, "utf-8");

      expect(actualContent.trim()).toBe(expectedContent.trim());
    });
  });
});
