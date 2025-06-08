import { Project } from "ts-morph";

export function moveFile(
  project: Project,
  options: { oldFilename: string; newFilename: string }
): void {
  const { oldFilename, newFilename } = options;
  const sourceFile = project.getSourceFile(oldFilename);
  
  if (!sourceFile) {
    throw new Error(`Source file not found: ${oldFilename}`);
  }
  
  sourceFile.move(newFilename);
}