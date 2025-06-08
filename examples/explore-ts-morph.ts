import { Project } from "ts-morph";
import path from "path";
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test different ways ts-morph can handle file discovery

async function exploreTsMorph() {
  console.log("=== Exploring ts-morph file discovery ===\n");

  // Test 1: Create project with tsconfig
  console.log("Test 1: Project with tsconfig.json");
  const project1 = new Project({
    tsConfigFilePath: path.join(__dirname, "../tsconfig.json"),
  });
  console.log("Source files from tsconfig:", project1.getSourceFiles().length);
  console.log("First few files:", project1.getSourceFiles().slice(0, 3).map(sf => sf.getFilePath()));

  // Test 2: Create project without tsconfig but with skipFileDependencyResolution
  console.log("\nTest 2: Project with skipFileDependencyResolution");
  const project2 = new Project({
    skipFileDependencyResolution: true,
  });
  console.log("Source files initially:", project2.getSourceFiles().length);
  
  // Add a single file
  const testFile = path.join(__dirname, "../src/commands/move_file.ts");
  project2.addSourceFileAtPath(testFile);
  console.log("After adding one file:", project2.getSourceFiles().length);
  
  // Check if dependencies are automatically added
  const sourceFile = project2.getSourceFile(testFile)!;
  const importDeclarations = sourceFile.getImportDeclarations();
  console.log("Import declarations in move_file.ts:", importDeclarations.length);
  
  // Test 3: Without skipFileDependencyResolution
  console.log("\nTest 3: Project WITHOUT skipFileDependencyResolution");
  const project3 = new Project({
    skipFileDependencyResolution: false,
  });
  
  project3.addSourceFileAtPath(testFile);
  console.log("After adding one file (with dependency resolution):", project3.getSourceFiles().length);
  console.log("Files added:", project3.getSourceFiles().map(sf => sf.getFilePath()));
  
  // Test 4: Using addSourceFilesAtPaths with glob
  console.log("\nTest 4: Using glob patterns");
  const project4 = new Project({
    skipFileDependencyResolution: true,
  });
  
  project4.addSourceFilesAtPaths("src/commands/*.ts");
  console.log("Files from glob pattern:", project4.getSourceFiles().length);
  
  // Test 5: Finding referencing files
  console.log("\nTest 5: Finding files that reference a symbol");
  const project5 = new Project({
    skipFileDependencyResolution: true,
  });
  
  // Add multiple files
  project5.addSourceFilesAtPaths("src/**/*.ts");
  const moveFileSource = project5.getSourceFile(path.join(__dirname, "../src/commands/move_file.ts"));
  
  if (moveFileSource) {
    const exportedFunction = moveFileSource.getFunction("moveFile");
    if (exportedFunction) {
      console.log("Looking for references to 'moveFile' function...");
      const referencingFiles = moveFileSource.getReferencingSourceFiles();
      console.log("Files referencing move_file.ts:", referencingFiles.length);
      
      // Find actual references
      const references = exportedFunction.findReferences();
      console.log("References found:", references.length);
      
      for (const ref of references) {
        console.log("Reference in:", ref.getDefinition().getSourceFile().getFilePath());
      }
    }
  }
  
  // Test 6: Check getReferencingSourceFiles behavior
  console.log("\nTest 6: getReferencingSourceFiles behavior");
  const project6 = new Project({
    skipFileDependencyResolution: true,
  });
  
  // Create a minimal test case
  const libFile = project6.createSourceFile("/tmp/lib.ts", "export const value = 42;");
  const mainFile = project6.createSourceFile("/tmp/main.ts", 'import { value } from "./lib";');
  
  console.log("Files referencing lib.ts:", libFile.getReferencingSourceFiles().map(f => f.getFilePath()));
  
  // Force resolution
  project6.resolveSourceFileDependencies();
  console.log("After resolving dependencies:", libFile.getReferencingSourceFiles().map(f => f.getFilePath()));
}

exploreTsMorph().catch(console.error);