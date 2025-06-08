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