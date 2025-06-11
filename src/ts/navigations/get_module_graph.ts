import { type Project } from "ts-morph";
import { type Result, ok, err } from "neverthrow";
import { isAbsolute, resolve, relative, dirname, join } from "path";

export interface ModuleNode {
  filePath: string;
  imports: string[];
  exports: string[];
  exportedSymbols: string[];
  importedFrom: string[];
}

export interface ModuleGraph {
  nodes: Map<string, ModuleNode>;
  rootFiles: string[];
  entryPoints: string[];
}

export interface GetModuleGraphRequest {
  rootDir: string;
  entryPoints: string[]; // Absolute or relative file paths to start analysis from
}

export interface GetModuleGraphSuccess {
  message: string;
  graph: {
    files: {
      path: string;
      imports: string[];
      exports: string[];
      exportedSymbols: string[];
      importedBy: string[];
    }[];
    stats: {
      totalFiles: number;
      totalImports: number;
      totalExports: number;
      circularDependencies: string[][];
    };
  };
}

export function getModuleGraph(
  project: Project,
  request: GetModuleGraphRequest
): Result<GetModuleGraphSuccess, string> {
  try {
    const graph: ModuleGraph = {
      nodes: new Map(),
      rootFiles: [],
      entryPoints: [],
    };

    // Resolve entry points to absolute paths
    const resolvedEntryPoints: string[] = [];
    for (const entryPoint of request.entryPoints) {
      const absolutePath = isAbsolute(entryPoint) 
        ? entryPoint 
        : resolve(request.rootDir, entryPoint);
      
      // Add the file to the project if it doesn't exist
      let sourceFile = project.getSourceFile(absolutePath);
      if (!sourceFile) {
        try {
          sourceFile = project.addSourceFileAtPath(absolutePath);
        } catch (error) {
          return err(`Failed to add entry point ${entryPoint}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      resolvedEntryPoints.push(sourceFile.getFilePath());
      graph.entryPoints.push(sourceFile.getFilePath());
    }

    // Build dependency graph starting from entry points
    const visited = new Set<string>();
    const queue = [...resolvedEntryPoints];

    while (queue.length > 0) {
      const filePath = queue.shift()!;
      if (visited.has(filePath)) continue;
      visited.add(filePath);

      const sourceFile = project.getSourceFile(filePath);
      if (!sourceFile) continue;

      const node: ModuleNode = {
        filePath,
        imports: [],
        exports: [],
        exportedSymbols: [],
        importedFrom: [],
      };

      // Collect imports
      const importDeclarations = sourceFile.getImportDeclarations();
      for (const importDecl of importDeclarations) {
        const moduleSpecifier = importDecl.getModuleSpecifierValue();
        const resolvedModule = resolveModulePath(filePath, moduleSpecifier, project);
        if (resolvedModule) {
          node.imports.push(resolvedModule);
          // Add to queue for processing
          if (!visited.has(resolvedModule)) {
            queue.push(resolvedModule);
          }
        }
      }

      // Collect exports (re-exports)
      const exportDeclarations = sourceFile.getExportDeclarations();
      for (const exportDecl of exportDeclarations) {
        const moduleSpecifier = exportDecl.getModuleSpecifierValue();
        if (moduleSpecifier) {
          const resolvedModule = resolveModulePath(filePath, moduleSpecifier, project);
          if (resolvedModule) {
            node.exports.push(resolvedModule);
            // Add to queue for processing
            if (!visited.has(resolvedModule)) {
              queue.push(resolvedModule);
            }
          }
        }
      }

      // Collect exported symbols
      const exportedSymbols = sourceFile.getExportSymbols();
      for (const symbol of exportedSymbols) {
        node.exportedSymbols.push(symbol.getName());
      }

      graph.nodes.set(filePath, node);
    }

    // Second pass: build reverse dependencies (importedFrom)
    for (const [filePath, node] of graph.nodes) {
      for (const importPath of node.imports) {
        const importedNode = graph.nodes.get(importPath);
        if (importedNode) {
          importedNode.importedFrom.push(filePath);
        }
      }
    }

    // Find entry points (files not imported by any other file)
    for (const [filePath, node] of graph.nodes) {
      if (node.importedFrom.length === 0) {
        graph.entryPoints.push(filePath);
      }
    }

    // Detect circular dependencies
    const circularDeps = detectCircularDependencies(graph);

    // Calculate stats
    let totalImports = 0;
    let totalExports = 0;
    for (const node of graph.nodes.values()) {
      totalImports += node.imports.length;
      totalExports += node.exportedSymbols.length;
    }

    // Convert to output format
    const files = Array.from(graph.nodes.values()).map(node => ({
      path: relative(request.rootDir, node.filePath),
      imports: node.imports.map(p => relative(request.rootDir, p)),
      exports: node.exports.map(p => relative(request.rootDir, p)),
      exportedSymbols: node.exportedSymbols,
      importedBy: node.importedFrom.map(p => relative(request.rootDir, p)),
    }));

    return ok({
      message: `Analyzed module graph: ${graph.nodes.size} files`,
      graph: {
        files,
        stats: {
          totalFiles: graph.nodes.size,
          totalImports,
          totalExports,
          circularDependencies: circularDeps.map(cycle => 
            cycle.map(p => relative(request.rootDir, p))
          ),
        },
      },
    });
  } catch (error) {
    return err(`Failed to analyze module graph: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function resolveModulePath(
  fromFile: string,
  moduleSpecifier: string,
  project: Project
): string | null {
  // Skip external modules
  if (!moduleSpecifier.startsWith('.') && !moduleSpecifier.startsWith('/')) {
    return null;
  }

  const fromDir = dirname(fromFile);
  const resolvedPath = resolve(fromDir, moduleSpecifier);

  // Try with TypeScript extensions
  const extensions = ['.ts', '.tsx', '.d.ts', '.js', '.jsx'];
  
  // Helper function to try to get or add a source file
  const tryGetOrAddSourceFile = (filePath: string): string | null => {
    let sourceFile = project.getSourceFile(filePath);
    if (!sourceFile) {
      // Try to add the file if it exists on disk
      try {
        const fs = require('fs');
        if (fs.existsSync(filePath)) {
          // Use addSourceFileAtPath which handles tsconfig exclusions better
          sourceFile = project.addSourceFileAtPath(filePath);
        }
      } catch {
        // Ignore errors - file might be excluded by tsconfig
      }
    }
    return sourceFile ? sourceFile.getFilePath() : null;
  };

  // First try the path as-is (if it already has an extension)
  const result = tryGetOrAddSourceFile(resolvedPath);
  if (result) return result;

  // Try adding extensions
  for (const ext of extensions) {
    const pathWithExt = resolvedPath + ext;
    const result = tryGetOrAddSourceFile(pathWithExt);
    if (result) return result;
  }

  // Try index files
  for (const ext of extensions) {
    const indexPath = join(resolvedPath, `index${ext}`);
    const result = tryGetOrAddSourceFile(indexPath);
    if (result) return result;
  }

  return null;
}

function detectCircularDependencies(graph: ModuleGraph): string[][] {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(filePath: string, path: string[]): void {
    visited.add(filePath);
    recursionStack.add(filePath);
    path.push(filePath);

    const node = graph.nodes.get(filePath);
    if (node) {
      for (const importPath of node.imports) {
        if (!visited.has(importPath)) {
          dfs(importPath, [...path]);
        } else if (recursionStack.has(importPath)) {
          // Found a cycle
          const cycleStart = path.indexOf(importPath);
          if (cycleStart !== -1) {
            const cycle = path.slice(cycleStart);
            cycle.push(importPath); // Complete the cycle
            
            // Check if this cycle is already recorded (in any rotation)
            const isNewCycle = !cycles.some(existingCycle => 
              areCyclesEqual(cycle, existingCycle)
            );
            
            if (isNewCycle) {
              cycles.push(cycle);
            }
          }
        }
      }
    }

    recursionStack.delete(filePath);
  }

  // Start DFS from all nodes
  for (const filePath of graph.nodes.keys()) {
    if (!visited.has(filePath)) {
      dfs(filePath, []);
    }
  }

  return cycles;
}

function areCyclesEqual(cycle1: string[], cycle2: string[]): boolean {
  if (cycle1.length !== cycle2.length) return false;
  
  // Find the starting point of cycle1 in cycle2
  const start = cycle2.indexOf(cycle1[0]);
  if (start === -1) return false;

  // Check if cycles are the same (considering rotation)
  for (let i = 0; i < cycle1.length - 1; i++) {
    const idx1 = i;
    const idx2 = (start + i) % (cycle2.length - 1);
    if (cycle1[idx1] !== cycle2[idx2]) {
      return false;
    }
  }

  return true;
}