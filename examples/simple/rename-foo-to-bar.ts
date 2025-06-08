import { createProject, renameSymbol, addSourceFile } from "../../src/renameSymbol";
import * as path from "path";
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const project = createProject(path.join(__dirname, "../../tsconfig.json"));
  
  const targetFile = path.join(__dirname, "main.ts");
  addSourceFile(project, targetFile);

  const result = await renameSymbol(project, {
    filePath: targetFile,
    line: 1,
    symbolName: "foo",
    newName: "bar",
    renameInComments: true,
    renameInStrings: true
  });

  if (result.success) {
    console.log("Rename successful!");
    console.log("Changed files:", result.changedFiles);
  } else {
    console.error("Rename failed:", result.error);
  }
}

main().catch(console.error);