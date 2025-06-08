import {
  Project,
  ScriptTarget,
  ModuleKind,
  ModuleResolutionKind,
} from "ts-morph";
import * as path from "path";
import * as fs from "fs/promises";

// Cache for projects by tsconfig path
const projectCache = new Map<string, Project>();

/**
 * Find the nearest tsconfig.json file starting from the given directory
 */
async function findTsConfig(startPath: string): Promise<string | null> {
  let currentPath = path.resolve(startPath);

  while (true) {
    const tsconfigPath = path.join(currentPath, "tsconfig.json");
    try {
      await fs.access(tsconfigPath);
      return tsconfigPath;
    } catch {
      // tsconfig.json not found in this directory
    }

    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      // Reached root directory
      break;
    }
    currentPath = parentPath;
  }

  return null;
}

/**
 * Get or create a TypeScript project, using cache for the same tsconfig
 */
export async function getOrCreateProject(
  workingDir?: string
): Promise<Project> {
  const searchPath = workingDir || process.cwd();

  // Find the nearest tsconfig.json
  const tsconfigPath = await findTsConfig(searchPath);

  // Use a special key for projects without tsconfig
  const cacheKey = tsconfigPath || "$$default$$";

  // Check cache first
  const cachedProject = projectCache.get(cacheKey);
  if (cachedProject) {
    return cachedProject;
  }

  // Create new project
  let project: Project;

  if (tsconfigPath) {
    // Create project with tsconfig
    project = new Project({
      tsConfigFilePath: tsconfigPath,
      skipFileDependencyResolution: true,
      manipulationSettings: {
        usePrefixAndSuffixTextForRename: true,
      },
    });
  } else {
    // Create default project without tsconfig
    project = new Project({
      skipFileDependencyResolution: true,
      manipulationSettings: {
        usePrefixAndSuffixTextForRename: true,
      },
      compilerOptions: {
        allowJs: true,
        target: ScriptTarget.ESNext,
        module: ModuleKind.ESNext,
        moduleResolution: ModuleResolutionKind.Bundler,
        esModuleInterop: true,
        noEmit: true,
        skipLibCheck: true,
        strict: true,
      },
    });
  }

  // Cache the project
  projectCache.set(cacheKey, project);

  return project;
}

/**
 * Find the appropriate project for a given file path
 */
export async function findProjectForFile(filePath: string): Promise<Project> {
  const absolutePath = path.resolve(filePath);
  const directory = path.dirname(absolutePath);

  return getOrCreateProject(directory);
}

/**
 * Clear the project cache
 */
export function clearProjectCache(): void {
  projectCache.clear();
}

/**
 * Get the current cache size
 */
export function getProjectCacheSize(): number {
  return projectCache.size;
}
