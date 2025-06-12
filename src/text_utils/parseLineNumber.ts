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

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  describe("parseLineNumber", () => {
    it("should parse line number to 0-based index", () => {
      const lines = ["line 1", "line 2", "line 3"];
      
      const result = parseLineNumber(lines, 2);
      expect(result).toEqual({ lineIndex: 1 });
    });

    it("should find line by string match", () => {
      const lines = ["const foo = 1;", "const bar = 2;", "const baz = 3;"];
      
      const result = parseLineNumber(lines, "bar = 2");
      expect(result).toEqual({ lineIndex: 1 });
    });

    it("should return error if string not found", () => {
      const lines = ["const foo = 1;", "const bar = 2;"];
      
      const result = parseLineNumber(lines, "not found");
      expect(result).toEqual({ error: 'Line containing "not found" not found' });
    });
  });
}