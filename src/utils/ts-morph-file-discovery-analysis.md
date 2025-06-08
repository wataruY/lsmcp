# ts-morph File Discovery Analysis

## Key Findings

### 1. **ts-morph CAN automatically discover project files** when using tsconfig.json
- When creating a Project with `tsConfigFilePath`, it automatically loads all files included in the tsconfig
- In our test, it loaded 14 files from the project automatically

### 2. **skipFileDependencyResolution behavior**
- With `skipFileDependencyResolution: true` - No automatic dependency resolution
- With `skipFileDependencyResolution: false` - Still doesn't automatically add imported files
- This flag mainly affects internal TypeScript resolution, not file discovery

### 3. **getReferencingSourceFiles() works properly**
- This method DOES find files that import/reference the current file
- But it only works if those files are already added to the project
- It doesn't automatically discover and add new files

### 4. **For refactoring operations, ts-morph needs files to be added to the project**
- `rename()` operations find references across all files in the project
- `move()` operations update imports in all files that are in the project
- Files not in the project won't be updated

## Current Implementation Issues

The current MCP server implementation manually reads directories with `fs.readdir` because:

1. It only adds files in the same directory as the target file
2. This misses files in parent/child directories that might import the target
3. It's not using ts-morph's full capabilities

## Recommended Improvements

### Option 1: Use tsconfig.json (Best for projects with tsconfig)
```typescript
const project = await findProjectForFile(absolutePath);
// This already uses tsconfig if found
```

### Option 2: Add all project files using glob patterns
```typescript
// Instead of just reading one directory:
const projectRoot = await findProjectRoot(absolutePath);
project.addSourceFilesAtPaths([
  path.join(projectRoot, "**/*.ts"),
  path.join(projectRoot, "**/*.tsx"),
  path.join(projectRoot, "**/*.js"),
  path.join(projectRoot, "**/*.jsx"),
]);
```

### Option 3: Use getReferencingSourceFiles() intelligently
```typescript
// First add the target file
project.addSourceFileAtPath(absolutePath);

// Then find and add files that reference it
const sourceFile = project.getSourceFile(absolutePath)!;
const referencingFiles = sourceFile.getReferencingSourceFiles();

// This requires files to already be in the project, so we need a hybrid approach
```

### Option 4: Hybrid approach (Recommended)
```typescript
async function ensureRelatedFilesInProject(
  project: Project,
  targetFilePath: string
): Promise<void> {
  // 1. Add the target file if not already present
  if (!project.getSourceFile(targetFilePath)) {
    project.addSourceFileAtPath(targetFilePath);
  }

  // 2. If project has tsconfig, it already has all files
  const sourceFiles = project.getSourceFiles();
  if (sourceFiles.length > 1) {
    return; // Assume tsconfig loaded files
  }

  // 3. Otherwise, add files from the current directory and parent directories
  const startDir = path.dirname(targetFilePath);
  const projectRoot = await findProjectRoot(startDir);
  
  // Add all TypeScript/JavaScript files in the project
  const patterns = [
    path.join(projectRoot, "**/*.ts"),
    path.join(projectRoot, "**/*.tsx"),
    path.join(projectRoot, "**/*.js"),
    path.join(projectRoot, "**/*.jsx"),
  ];
  
  for (const pattern of patterns) {
    try {
      project.addSourceFilesAtPaths(pattern);
    } catch {
      // Ignore errors for patterns that don't match
    }
  }
}
```

## Conclusion

The manual `fs.readdir` approach in the current implementation is suboptimal. ts-morph can handle file discovery much better when:
1. Using tsconfig.json (automatically loads all project files)
2. Using glob patterns to add multiple files
3. Properly utilizing the project structure

The current approach of only adding files from the same directory will miss many important files that might need updating during refactoring operations.