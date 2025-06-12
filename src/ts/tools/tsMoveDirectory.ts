import { z } from "zod";
import type { ToolDef } from "../../mcp/types";
import { moveDirectory } from "../commands/moveDirectory";
import { resolve } from "node:path";

const schema = z.object({
  root: z.string().optional().describe("Root directory for resolving relative paths"),
  sourcePath: z.string().describe("The relative path of the directory to move"),
  targetPath: z.string().describe("The new relative path for the directory"),
  overwrite: z
    .boolean()
    .optional()
    .describe("Whether to overwrite existing directory at target path"),
});

export const moveDirectoryTool: ToolDef<typeof schema> = {
  name: "move_directory",
  description:
    "Move a directory to a new location, updating all TypeScript imports and references automatically",
  schema,
  execute: async (input) => {
    const rootPath = input.root || process.cwd();
    const source = resolve(rootPath, input.sourcePath);
    const target = resolve(rootPath, input.targetPath);

    const result = await moveDirectory(rootPath, source, target, {
      overwrite: input.overwrite,
    });

    if (!result.success) {
      throw new Error(result.error || "Failed to move directory");
    }

    return JSON.stringify(
      {
        success: true,
        movedFiles: result.movedFiles.map((filePath) => ({
          path: filePath.replace(rootPath + "/", ""),
        })),
        message: `Successfully moved directory from ${input.sourcePath} to ${input.targetPath}. Moved ${result.movedFiles.length} files.`,
      },
      null,
      2
    );
  },
};

if (import.meta.vitest) {
  const { describe, it, expect, beforeEach, afterEach } = import.meta.vitest;
  const { Project } = await import("ts-morph");
  const { mkdir, writeFile, rm } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { existsSync } = await import("node:fs");
  const { clearProjectCache } = await import("../projectCache.ts");

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
            strict: true,
          },
        })
      );

      // Initialize project and add source files
      project = new Project({
        tsConfigFilePath: join(testDir, "tsconfig.json"),
      });
      project.addSourceFilesAtPaths(join(testDir, "src", "**", "*.ts"));
    });

    afterEach(async () => {
      await rm(testDir, { recursive: true, force: true });
      clearProjectCache();
    });

    it("should move directory and update imports", async () => {
      const result = await moveDirectoryTool.execute({
        root: testDir,
        sourcePath: "src/components",
        targetPath: "src/ui/components",
        overwrite: false,
      });

        const parsed = JSON.parse(result) as MoveDirectoryResult;
        expect(parsed.success).toBe(true);
        expect(parsed.movedFiles).toHaveLength(2);
        expect(parsed.movedFiles).toContainEqual({
          path: "src/ui/components/Button.ts",
        });
        expect(parsed.movedFiles).toContainEqual({
          path: "src/ui/components/Card.ts",
        });

        // Verify directory was moved
        expect(existsSync(join(testDir, "src", "components"))).toBe(false);
        expect(existsSync(join(testDir, "src", "ui", "components"))).toBe(true);

        // Verify imports were updated
        const project = new Project({
          tsConfigFilePath: join(testDir, "tsconfig.json"),
        });
        const helpersFile = project.getSourceFileOrThrow(
          join(testDir, "src", "utils", "helpers.ts")
        );
        const helpersText = helpersFile.getFullText();
        // Helper file content should contain updated import
        expect(helpersText).toContain("../ui/components/Button");
    });

    it("should throw error for non-existent directory", async () => {
      await expect(
        moveDirectoryTool.execute({
          root: testDir,
          sourcePath: "src/nonexistent",
          targetPath: "src/moved",
        })
      ).rejects.toThrow("Directory not found");
    });

    it("should handle overwrite option", async () => {
      // Create target directory
      await mkdir(join(testDir, "src", "ui", "components"), { recursive: true });
      await writeFile(
        join(testDir, "src", "ui", "components", "existing.ts"),
        `export const existing = true;`
      );

      const result = await moveDirectoryTool.execute({
        root: testDir,
        sourcePath: "src/components",
        targetPath: "src/ui/components",
        overwrite: true,
      });

      const parsed = JSON.parse(result) as MoveDirectoryResult;
      expect(parsed.success).toBe(true);
      expect(parsed.movedFiles).toHaveLength(2);
    });
  });
}
