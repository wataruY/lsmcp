import { z } from "zod";
import type { ToolDef } from "../types.ts";
import { Project } from "ts-morph";
import { getModuleGraph } from "../../navigations/get_module_graph.ts";

const paramsSchema = z.object({
  root: z.string().describe("Root directory for resolving relative paths"),
  entryPoints: z
    .array(z.string())
    .describe(
      "Entry point files to start analysis from (relative or absolute paths)"
    ),
  useMermaid: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include Mermaid diagram visualization"),
});

export const getModuleGraphTool: ToolDef<typeof paramsSchema> = {
  name: "get_module_graph",
  description:
    "Analyze the module dependency graph of a TypeScript/JavaScript project",
  schema: paramsSchema,
  handler: async (args) => {
    // Create a fresh project for module graph analysis without tsconfig exclusions
    const project = new Project({
      compilerOptions: {
        target: 99, // ESNext
        module: 99, // ESNext
        moduleResolution: 2, // Node
        allowJs: true,
        skipLibCheck: true,
        strict: false,
      },
      skipFileDependencyResolution: true,
    });

    const result = getModuleGraph(project, {
      rootDir: args.root,
      entryPoints: args.entryPoints,
    });

    if (result.isErr()) {
      throw new Error(result.error);
    }

    const { graph } = result.value;
    const lines: string[] = [];

    lines.push(`📊 Module Graph Analysis`);
    lines.push(
      `Found ${graph.stats.totalFiles} files with ${graph.stats.totalImports} imports and ${graph.stats.totalExports} exports\n`
    );

    if (graph.stats.circularDependencies.length > 0) {
      lines.push(`⚠️  Circular Dependencies Detected:`);
      graph.stats.circularDependencies.forEach((cycle, i) => {
        lines.push(`  ${i + 1}. ${cycle.join(" → ")}`);
      });
      lines.push("");
    }

    // Build a map for quick lookup
    const fileMap = new Map(graph.files.map((f) => [f.path, f]));

    // Find entry points
    const entryPoints = graph.files.filter((f) => f.importedBy.length === 0);

    // Topological sort starting from entry points
    const visited = new Set<string>();
    const sorted: string[] = [];

    function visit(filePath: string, level: number = 0): void {
      if (visited.has(filePath)) return;
      visited.add(filePath);

      const file = fileMap.get(filePath);
      if (file) {
        // Visit dependencies first (post-order traversal)
        for (const importPath of file.imports) {
          visit(importPath, level + 1);
        }
        sorted.push(filePath);
      }
    }

    // Start from entry points
    for (const entry of entryPoints) {
      visit(entry.path);
    }

    // Add any remaining files (in case of disconnected components)
    for (const file of graph.files) {
      visit(file.path);
    }

    // Display in topological order (dependency tree)
    lines.push(`🌳 Module Dependency Tree (Topological Order):`);

    // Build indentation levels
    const levels = new Map<string, number>();
    const processed = new Set<string>();

    function calculateLevel(filePath: string): number {
      if (levels.has(filePath)) return levels.get(filePath)!;

      const file = fileMap.get(filePath);
      if (!file || file.importedBy.length === 0) {
        levels.set(filePath, 0);
        return 0;
      }

      // Find the minimum level of all importers
      let minLevel = Infinity;
      for (const importer of file.importedBy) {
        if (!processed.has(importer)) continue;
        const importerLevel = levels.get(importer) ?? 0;
        minLevel = Math.min(minLevel, importerLevel + 1);
      }

      const level = minLevel === Infinity ? 0 : minLevel;
      levels.set(filePath, level);
      return level;
    }

    // Display files in topological order with tree structure
    for (const filePath of sorted) {
      processed.add(filePath);
      const level = calculateLevel(filePath);
      const file = fileMap.get(filePath)!;
      const indent = "  ".repeat(level);
      const arrow = level > 0 ? "└─ " : "";
      const exportInfo =
        file.exportedSymbols.length > 0
          ? ` (exports: ${file.exportedSymbols.slice(0, 3).join(", ")}${
              file.exportedSymbols.length > 3 ? "..." : ""
            })`
          : "";
      lines.push(`${indent}${arrow}${filePath}${exportInfo}`);
    }
    lines.push("");

    // Find most imported files
    const mostImported = graph.files
      .filter((f) => f.importedBy.length > 0)
      .sort((a, b) => b.importedBy.length - a.importedBy.length)
      .slice(0, 5);

    if (mostImported.length > 0) {
      lines.push(`📥 Most Imported Files:`);
      mostImported.forEach((file) => {
        lines.push(
          `  - ${file.path} (imported by ${file.importedBy.length} files)`
        );
      });
    }

    // Add Mermaid graph visualization if requested
    if (args.useMermaid) {
      lines.push("");
      lines.push("📊 Mermaid Dependency Graph:");
      lines.push("```mermaid");
      lines.push(`graph TD`);

      // Create node IDs by replacing special characters
      const createNodeId = (path: string) => {
        return path.replace(/[^\w]/g, "_").replace(/__+/g, "_");
      };

      // Add nodes with labels (use filename for readability)
      graph.files.forEach((file) => {
        const nodeId = createNodeId(file.path);
        const label = file.path.split("/").pop() || file.path;
        lines.push(`    ${nodeId}["${label}"]`);
      });

      // Add edges
      graph.files.forEach((file) => {
        const fromId = createNodeId(file.path);
        file.imports.forEach((importPath) => {
          const toId = createNodeId(importPath);
          lines.push(`    ${fromId} --> ${toId}`);
        });
      });

      // Highlight circular dependencies if any
      if (graph.stats.circularDependencies.length > 0) {
        lines.push("");
        lines.push("    %% Circular dependencies are highlighted");
        graph.stats.circularDependencies.forEach((cycle, idx) => {
          lines.push(
            `    classDef circular${idx} fill:#f96,stroke:#333,stroke-width:4px;`
          );
          cycle.slice(0, -1).forEach((filePath) => {
            const nodeId = createNodeId(filePath);
            lines.push(`    class ${nodeId} circular${idx};`);
          });
        });
      }

      lines.push("```");
    }

    return lines.join("\n");
  },
};
