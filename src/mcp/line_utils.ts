import { SourceFile } from "ts-morph";

/**
 * Resolves a line parameter that can be either a line number or a string to match
 * @param sourceFile The source file to search in
 * @param lineParam Either a line number (1-based) or a string to match
 * @returns The resolved line number (1-based) or throws an error
 */
export function resolveLineParameter(
  sourceFile: SourceFile,
  lineParam: number | string
): number {
  if (typeof lineParam === "number") {
    // Direct line number provided
    const lines = sourceFile.getFullText().split("\n");
    if (lineParam < 1 || lineParam > lines.length) {
      throw new Error(`Invalid line number: ${lineParam}. File has ${lines.length} lines.`);
    }
    return lineParam;
  }

  // String provided - find the line containing this string
  const lines = sourceFile.getFullText().split("\n");
  const matchingLines: number[] = [];

  lines.forEach((line, index) => {
    if (line.includes(lineParam)) {
      matchingLines.push(index + 1); // Convert to 1-based
    }
  });

  if (matchingLines.length === 0) {
    throw new Error(`No line found containing: "${lineParam}"`);
  }

  if (matchingLines.length > 1) {
    throw new Error(
      `Multiple lines found containing "${lineParam}". Found on lines: ${matchingLines.join(
        ", "
      )}. Please be more specific or use a line number.`
    );
  }

  return matchingLines[0];
}

/**
 * Finds the column position of a symbol in a specific line
 * @param sourceFile The source file
 * @param lineNumber The line number (1-based)
 * @param symbolName The symbol name to find
 * @param index The occurrence index to find (0-based, default: 0)
 * @returns Object with line text and column position (1-based) or throws an error
 */
export function findSymbolInLine(
  sourceFile: SourceFile,
  lineNumber: number,
  symbolName: string,
  index: number = 0
): { lineText: string; column: number } {
  const fullText = sourceFile.getFullText();
  const lines = fullText.split("\n");
  
  if (lineNumber < 1 || lineNumber > lines.length) {
    throw new Error(`Invalid line number: ${lineNumber}. File has ${lines.length} lines.`);
  }
  
  const lineText = lines[lineNumber - 1];
  
  // Find all occurrences
  const occurrences: number[] = [];
  let searchIndex = 0;
  
  while (true) {
    const foundIndex = lineText.indexOf(symbolName, searchIndex);
    if (foundIndex === -1) break;
    occurrences.push(foundIndex);
    searchIndex = foundIndex + 1;
  }
  
  if (occurrences.length === 0) {
    throw new Error(`Symbol "${symbolName}" not found on line ${lineNumber}`);
  }
  
  if (index < 0 || index >= occurrences.length) {
    throw new Error(
      `Symbol "${symbolName}" only appears ${occurrences.length} time(s) on line ${lineNumber}, but index ${index} was requested`
    );
  }
  
  // Convert to 1-based column
  return {
    lineText,
    column: occurrences[index] + 1
  };
}