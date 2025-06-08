import { Project } from "ts-morph";
import { Result, ok, err } from "neverthrow";

export interface MoveFileResult {
  message: string;
  changedFiles: string[];
}

export function moveFile(
  project: Project,
  options: { oldFilename: string; newFilename: string }
): Result<MoveFileResult, string> {
  const { oldFilename, newFilename } = options;
  const sourceFile = project.getSourceFile(oldFilename);
  
  if (!sourceFile) {
    return err(`Source file not found: ${oldFilename}`);
  }
  
  try {
    // Get all files that will be affected
    const changedFiles = new Set<string>();
    
    // Add the moved file itself
    changedFiles.add(oldFilename);
    
    // Find all files that import this file
    for (const referencingFile of sourceFile.getReferencingSourceFiles()) {
      changedFiles.add(referencingFile.getFilePath());
    }
    
    // Perform the move
    sourceFile.move(newFilename);
    
    return ok({
      message: `Successfully moved file from "${oldFilename}" to "${newFilename}"`,
      changedFiles: Array.from(changedFiles),
    });
  } catch (error) {
    return err(`Failed to move file: ${error instanceof Error ? error.message : String(error)}`);
  }
}