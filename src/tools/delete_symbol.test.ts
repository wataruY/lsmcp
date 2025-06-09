import { describe, it, expect } from "vitest";
import { formatDeleteSymbolResult } from "./delete_symbol.ts";
import type { DeleteSymbolResult } from "./delete_symbol.ts";

describe("delete_symbol", () => {
  describe("formatDeleteSymbolResult", () => {
    it("should format single file deletion", () => {
      const result: DeleteSymbolResult = {
        message: "Removed symbol 'myFunction'",
        removedFromFiles: ["/path/to/file.ts"],
      };

      expect(formatDeleteSymbolResult(result)).toMatchInlineSnapshot(
        `"Removed symbol 'myFunction' from 1 file(s)."`
      );
    });

    it("should format multiple file deletion", () => {
      const result: DeleteSymbolResult = {
        message: "Removed symbol 'MyClass'",
        removedFromFiles: [
          "/path/to/file1.ts",
          "/path/to/file2.ts",
          "/path/to/file3.ts",
        ],
      };

      expect(formatDeleteSymbolResult(result)).toMatchInlineSnapshot(
        `"Removed symbol 'MyClass' from 3 file(s)."`
      );
    });

    it("should format zero file deletion", () => {
      const result: DeleteSymbolResult = {
        message: "Removed symbol 'unusedVar'",
        removedFromFiles: [],
      };

      expect(formatDeleteSymbolResult(result)).toMatchInlineSnapshot(
        `"Removed symbol 'unusedVar' from 0 file(s)."`
      );
    });
  });
});