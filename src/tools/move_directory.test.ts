import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Project } from "ts-morph";
import { move_directory } from "./move_directory.ts";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { clearProjectCache } from "../utils/project_cache.ts";

interface MoveDirectoryResult {
  success: boolean;
  movedFiles: Array<{ path: string }>;
  message: string;
}

describe("move_directory", () => {
  const testDir = join(process.cwd(), "test-tmp-move-dir");
  let project: Project;
  
  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
    await mkdir(join(testDir, "src", "components"), { recursive: true });
    await mkdir(join(testDir, "src", "utils"), { recursive: true });
    
    // Create test files
    await writeFile(
      join(testDir, "src", "components", "Button.ts"),
      `export const Button = () => "Button";`
    );
    
    await writeFile(
      join(testDir, "src", "components", "Card.ts"),
      `import { Button } from "./Button.ts";
export const Card = () => Button();`
    );
    
    await writeFile(
      join(testDir, "src", "utils", "helpers.ts"),
      `import { Button } from "../components/Button.ts";
export const useButton = () => Button();`
    );
    
    await writeFile(
      join(testDir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2020",
          module: "commonjs",
          strict: true
        }
      })
    );
    
    // Initialize project and add source files
    project = new Project({
      tsConfigFilePath: join(testDir, "tsconfig.json")
    });
    project.addSourceFilesAtPaths(join(testDir, "src", "**", "*.ts"));
  });
  
  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    clearProjectCache();
  });
  
  it("should move directory and update imports", async () => {
    // Change working directory to test directory
    const originalCwd = process.cwd();
    process.chdir(testDir);
    
    try {
      const result = await move_directory.handler({
        sourcePath: "src/components",
        targetPath: "src/ui/components",
        overwrite: false
      });
      
      const parsed = JSON.parse(result) as MoveDirectoryResult;
      expect(parsed.success).toBe(true);
      expect(parsed.movedFiles).toHaveLength(2);
      expect(parsed.movedFiles).toContainEqual({ path: "src/ui/components/Button.ts" });
      expect(parsed.movedFiles).toContainEqual({ path: "src/ui/components/Card.ts" });
    
    // Verify directory was moved
    expect(existsSync(join(testDir, "src", "components"))).toBe(false);
    expect(existsSync(join(testDir, "src", "ui", "components"))).toBe(true);
    
      // Verify imports were updated
      const project = new Project({ tsConfigFilePath: join(testDir, "tsconfig.json") });
      const helpersFile = project.getSourceFileOrThrow(join(testDir, "src", "utils", "helpers.ts"));
      const helpersText = helpersFile.getFullText();
      // Helper file content should contain updated import
      expect(helpersText).toContain("../ui/components/Button");
    } finally {
      process.chdir(originalCwd);
    }
  });
  
  it("should throw error for non-existent directory", async () => {
    const originalCwd = process.cwd();
    process.chdir(testDir);
    
    try {
      await expect(
        move_directory.handler({
          sourcePath: "src/nonexistent",
          targetPath: "src/moved"
        })
      ).rejects.toThrow("Directory not found");
    } finally {
      process.chdir(originalCwd);
    }
  });
  
  it("should handle overwrite option", async () => {
    // Create target directory
    await mkdir(join(testDir, "src", "ui", "components"), { recursive: true });
    await writeFile(
      join(testDir, "src", "ui", "components", "existing.ts"),
      `export const existing = true;`
    );
    
    const originalCwd = process.cwd();
    process.chdir(testDir);
    
    try {
      const result = await move_directory.handler({
        sourcePath: "src/components",
        targetPath: "src/ui/components",
        overwrite: true
      });
      
      const parsed = JSON.parse(result) as MoveDirectoryResult;
      expect(parsed.success).toBe(true);
      expect(parsed.movedFiles).toHaveLength(2);
    } finally {
      process.chdir(originalCwd);
    }
  });
});