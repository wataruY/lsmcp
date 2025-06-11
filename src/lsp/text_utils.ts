/**
 * Parses a line number from either a number or a string match
 * @param lines Array of file lines
 * @param line Line number (1-based) or string to match
 * @returns 0-based line index or error message
 */
export function parseLineNumber(
  lines: string[],
  line: number | string
): { lineIndex: number } | { error: string } {
  if (typeof line === "string") {
    const lineIndex = lines.findIndex((l) => l.includes(line));
    if (lineIndex === -1) {
      return { error: `Line containing "${line}" not found` };
    }
    return { lineIndex };
  } else {
    return { lineIndex: line - 1 }; // Convert to 0-based
  }
}

/**
 * Finds the position of a symbol within a line
 * @param lineText The text of the line
 * @param symbolName The symbol to find
 * @param symbolIndex Optional index if symbol appears multiple times (0-based)
 * @returns Character index or error message
 */
export function findSymbolInLine(
  lineText: string,
  symbolName: string,
  symbolIndex: number = 0
): { characterIndex: number } | { error: string } {
  let currentIndex = -1;
  let foundCount = 0;

  while (foundCount <= symbolIndex) {
    currentIndex = lineText.indexOf(symbolName, currentIndex + 1);
    if (currentIndex === -1) {
      if (foundCount === 0) {
        return { error: `Symbol "${symbolName}" not found` };
      } else {
        return {
          error: `Symbol "${symbolName}" occurrence ${symbolIndex} not found (only ${foundCount} occurrences)`,
        };
      }
    }
    foundCount++;
  }

  return { characterIndex: currentIndex };
}

/**
 * Finds the first occurrence of target text across all lines
 * @param lines Array of file lines
 * @param target Text to find
 * @returns Line index and character position or error
 */
export function findTargetInFile(
  lines: string[],
  target: string
): { lineIndex: number; characterIndex: number } | { error: string } {
  for (let i = 0; i < lines.length; i++) {
    const charIndex = lines[i].indexOf(target);
    if (charIndex !== -1) {
      return { lineIndex: i, characterIndex: charIndex };
    }
  }
  return { error: `Target text "${target}" not found in file` };
}