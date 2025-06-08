import { Project, SourceFile } from "ts-morph";
import { Result, ok, err } from "neverthrow";
import { isAbsolute, resolve, relative, dirname, join } from "path";

export interface GetRelatedModulesRequest {
  filePath: string;
  rootDir: string;
}

export interface RelatedModule {
  path: string;
  relationship: "imports" | "imported-by" | "re-exports" | "re-exported-by";
  symbols?: string[]; // Specific symbols imported/exported
}

export interface GetRelatedModulesSuccess {
  message: string;
  targetFile: string;
  relatedModules: RelatedModule[];
  stats: {
    totalImports: number;
    totalImportedBy: number;
    totalReExports: number;
    totalReExportedBy: number;
  };
}

export function getRelatedModules(
  project: Project,
  request: GetRelatedModulesRequest
): Result<GetRelatedModulesSuccess, string> {
  try {
    const absolutePath = isAbsolute(request.filePath)
      ? request.filePath
      : resolve(request.rootDir, request.filePath);

    // Get or add the target file
    let sourceFile = project.getSourceFile(absolutePath);
    if (!sourceFile) {
      try {
        sourceFile = project.addSourceFileAtPath(absolutePath);
      } catch (error) {
        return err(`Failed to load file ${request.filePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const relatedModules: RelatedModule[] = [];
    const targetFilePath = sourceFile.getFilePath();

    // 1. Find direct imports (files this file imports)
    const importDeclarations = sourceFile.getImportDeclarations();
    for (const importDecl of importDeclarations) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      const resolvedModule = resolveModulePath(targetFilePath, moduleSpecifier, project);
      
      if (resolvedModule) {
        const namedImports = importDecl.getNamedImports();
        const symbols = namedImports.map(imp => imp.getName());
        
        relatedModules.push({
          path: relative(request.rootDir, resolvedModule),
          relationship: "imports",
          symbols: symbols.length > 0 ? symbols : undefined,
        });
      }
    }

    // 2. Find re-exports (files this file re-exports from)
    const exportDeclarations = sourceFile.getExportDeclarations();
    for (const exportDecl of exportDeclarations) {
      const moduleSpecifier = exportDecl.getModuleSpecifierValue();
      if (moduleSpecifier) {
        const resolvedModule = resolveModulePath(targetFilePath, moduleSpecifier, project);
        
        if (resolvedModule) {
          const namedExports = exportDecl.getNamedExports();
          const symbols = namedExports.map(exp => exp.getName());
          
          relatedModules.push({
            path: relative(request.rootDir, resolvedModule),
            relationship: "re-exports",
            symbols: symbols.length > 0 ? symbols : undefined,
          });
        }
      }
    }

    // 3. Find files that import this file
    // We need to check all source files in the project
    const allSourceFiles = project.getSourceFiles();
    
    for (const otherFile of allSourceFiles) {
      if (otherFile === sourceFile) continue;
      
      // Check imports
      const imports = otherFile.getImportDeclarations();
      for (const importDecl of imports) {
        const moduleSpecifier = importDecl.getModuleSpecifierValue();
        const resolvedModule = resolveModulePath(otherFile.getFilePath(), moduleSpecifier, project);
        
        if (resolvedModule === targetFilePath) {
          const namedImports = importDecl.getNamedImports();
          const symbols = namedImports.map(imp => imp.getName());
          
          relatedModules.push({
            path: relative(request.rootDir, otherFile.getFilePath()),
            relationship: "imported-by",
            symbols: symbols.length > 0 ? symbols : undefined,
          });
        }
      }
      
      // Check re-exports
      const exports = otherFile.getExportDeclarations();
      for (const exportDecl of exports) {
        const moduleSpecifier = exportDecl.getModuleSpecifierValue();
        if (moduleSpecifier) {
          const resolvedModule = resolveModulePath(otherFile.getFilePath(), moduleSpecifier, project);
          
          if (resolvedModule === targetFilePath) {
            const namedExports = exportDecl.getNamedExports();
            const symbols = namedExports.map(exp => exp.getName());
            
            relatedModules.push({
              path: relative(request.rootDir, otherFile.getFilePath()),
              relationship: "re-exported-by",
              symbols: symbols.length > 0 ? symbols : undefined,
            });
          }
        }
      }
    }

    // Calculate stats
    const stats = {
      totalImports: relatedModules.filter(m => m.relationship === "imports").length,
      totalImportedBy: relatedModules.filter(m => m.relationship === "imported-by").length,
      totalReExports: relatedModules.filter(m => m.relationship === "re-exports").length,
      totalReExportedBy: relatedModules.filter(m => m.relationship === "re-exported-by").length,
    };

    return ok({
      message: `Found ${relatedModules.length} related modules`,
      targetFile: relative(request.rootDir, targetFilePath),
      relatedModules,
      stats,
    });
  } catch (error) {
    return err(`Failed to analyze related modules: ${error instanceof Error ? error.message : String(error)}`);
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
  let resolvedPath = resolve(fromDir, moduleSpecifier);

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
      } catch (e) {
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