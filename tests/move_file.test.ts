import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Project } from "ts-morph";
import { moveFile } from "../src/commands/move_file";
import fs from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { parseMoveComments } from "./helpers/extract-move-ops";
import { globSync } from "fs";

const FIXTURES_DIR = path.join(__dirname, "fixtures/01-move");

describe("moveFile", () => {
  describe("fixture-based tests", () => {
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

    // Find all .input.ts and .input.d.ts files in the fixtures directory
    const inputFiles = globSync("*.input.{ts,d.ts}", { cwd: FIXTURES_DIR });
    const testCases = inputFiles.map(file => {
      const ext = file.endsWith('.d.ts') ? '.d.ts' : '.ts';
      return {
        name: path.basename(file, `.input${ext}`),
        inputFile: file,
        ext
      };
    });

    testCases.forEach(({ name, inputFile, ext }) => {
      it(`should move ${name}`, async () => {
        // Parse move operation from @move comment
        const inputPath = path.join(FIXTURES_DIR, inputFile);
        const operations = await parseMoveComments(inputPath);
        expect(operations.length).toBe(1);

        const op = operations[0];
        const project = new Project({
          skipFileDependencyResolution: true,
        });

        // Copy input file to temp directory with original name
        const originalPath = path.join(tmpDir, op.oldPath);
        await fs.mkdir(path.dirname(originalPath), { recursive: true });
        await fs.copyFile(inputPath, originalPath);

        // If there's a consumer file, copy it too
        const consumerFile = path.join(FIXTURES_DIR, `${name}.consumer.ts`);
        if (await fs.access(consumerFile).then(() => true).catch(() => false)) {
          const consumerPath = path.join(tmpDir, `${name}.consumer.ts`);
          await fs.copyFile(consumerFile, consumerPath);
          project.addSourceFileAtPath(consumerPath);
        }

        // Add source file to project
        project.addSourceFileAtPath(originalPath);

        // Perform the move
        const newPath = path.join(tmpDir, op.newPath);
        await fs.mkdir(path.dirname(newPath), { recursive: true });

        moveFile(project, {
          oldFilename: originalPath,
          newFilename: newPath,
        });

        // Save changes
        await project.save();

        // Verify old file doesn't exist
        await expect(fs.access(originalPath)).rejects.toThrow();

        // Verify new file exists
        await expect(fs.access(newPath)).resolves.toBeUndefined();

        // If there's an expected consumer file, compare it
        const expectedConsumerFile = path.join(FIXTURES_DIR, `${name}.expected.consumer.ts`);
        if (await fs.access(expectedConsumerFile).then(() => true).catch(() => false)) {
          const actualConsumerPath = path.join(tmpDir, `${name}.consumer.ts`);
          const actualContent = await fs.readFile(actualConsumerPath, "utf-8");
          const expectedContent = await fs.readFile(expectedConsumerFile, "utf-8");
          expect(actualContent.trim()).toBe(expectedContent.trim());
        }
      });
    });
  });

  describe("unit tests", () => {
    let tmpDir: string;
    let project: Project;

    beforeEach(async () => {
      // Create temporary directory with random hash
      const hash = randomBytes(8).toString("hex");
      tmpDir = path.join(__dirname, `tmp-${hash}`);
      await fs.mkdir(tmpDir, { recursive: true });
      
      project = new Project({
        skipFileDependencyResolution: true,
      });
    });

    afterEach(async () => {
      // Cleanup tmp directory
      if (tmpDir) {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });

  it("should move a file to a new location", async () => {
    const oldPath = path.join(tmpDir, "old.ts");
    const newPath = path.join(tmpDir, "new.ts");
    
    // Create a source file with some content
    await fs.writeFile(oldPath, `export const foo = "bar";`);
    project.addSourceFileAtPath(oldPath);
    
    // Move the file
    moveFile(project, {
      oldFilename: oldPath,
      newFilename: newPath,
    });
    
    // Save changes
    await project.save();
    
    // Verify old file doesn't exist
    await expect(fs.access(oldPath)).rejects.toThrow();
    
    // Verify new file exists with correct content
    const newContent = await fs.readFile(newPath, "utf-8");
    expect(newContent).toBe(`export const foo = "bar";`);
  });

  it("should move a file to a different directory", async () => {
    const subDir = path.join(tmpDir, "subdir");
    await fs.mkdir(subDir, { recursive: true });
    
    const oldPath = path.join(tmpDir, "source.ts");
    const newPath = path.join(subDir, "moved.ts");
    
    // Create a source file
    await fs.writeFile(oldPath, `export function test() { return true; }`);
    project.addSourceFileAtPath(oldPath);
    
    // Move the file
    moveFile(project, {
      oldFilename: oldPath,
      newFilename: newPath,
    });
    
    // Save changes
    await project.save();
    
    // Verify old file doesn't exist
    await expect(fs.access(oldPath)).rejects.toThrow();
    
    // Verify new file exists
    const newContent = await fs.readFile(newPath, "utf-8");
    expect(newContent).toBe(`export function test() { return true; }`);
  });

  it("should update import statements when moving a file", async () => {
    const libPath = path.join(tmpDir, "lib.ts");
    const indexPath = path.join(tmpDir, "index.ts");
    const newLibPath = path.join(tmpDir, "utils", "lib.ts");
    
    // Create utils directory
    await fs.mkdir(path.join(tmpDir, "utils"), { recursive: true });
    
    // Create files
    await fs.writeFile(libPath, `export const helper = () => "help";`);
    await fs.writeFile(indexPath, `import { helper } from "./lib";\n\nconsole.log(helper());`);
    
    project.addSourceFileAtPath(libPath);
    project.addSourceFileAtPath(indexPath);
    
    // Move the file
    moveFile(project, {
      oldFilename: libPath,
      newFilename: newLibPath,
    });
    
    // Save changes
    await project.save();
    
    // Verify import was updated
    const indexContent = await fs.readFile(indexPath, "utf-8");
    expect(indexContent).toContain(`import { helper } from "./utils/lib"`);
  });

  it("should throw error when source file doesn't exist", () => {
    const oldPath = path.join(tmpDir, "non-existent.ts");
    const newPath = path.join(tmpDir, "new.ts");
    
    expect(() => {
      moveFile(project, {
        oldFilename: oldPath,
        newFilename: newPath,
      });
    }).toThrow(`Source file not found: ${oldPath}`);
  });

  it("should handle moving TypeScript declaration files", async () => {
    const oldPath = path.join(tmpDir, "types.d.ts");
    const newPath = path.join(tmpDir, "global.d.ts");
    
    // Create a declaration file
    await fs.writeFile(oldPath, `declare module "my-module" {\n  export function test(): void;\n}`);
    project.addSourceFileAtPath(oldPath);
    
    // Move the file
    moveFile(project, {
      oldFilename: oldPath,
      newFilename: newPath,
    });
    
    // Save changes
    await project.save();
    
    // Verify file was moved
    await expect(fs.access(oldPath)).rejects.toThrow();
    const newContent = await fs.readFile(newPath, "utf-8");
    expect(newContent).toContain(`declare module "my-module"`);
  });
  });
});