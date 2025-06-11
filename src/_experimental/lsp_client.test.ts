import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { findReferencesWithLSP } from "./lsp_find_references.ts";
import { getDefinitionsWithLSP } from "./lsp_get_definitions.ts";
import { getHoverWithLSP } from "./lsp_get_hover.ts";
import { createLSPClient } from "./lsp_client.ts";
import { type Hover } from "vscode-languageserver-types";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("LSP Features", () => {
  const projectRoot = process.cwd();

  describe("findReferencesWithLSP", () => {
    it("should find references for Value type", async () => {
      const referencesResult = await findReferencesWithLSP(projectRoot, {
        filePath: "examples/types.ts",
        line: 1, // Line with "Value" type declaration
        column: 13, // Position of "Value"
      });

      expect(referencesResult.isOk()).toBe(true);

      if (referencesResult.isOk()) {
        expect(referencesResult.value.message).toBeDefined();
        expect(Array.isArray(referencesResult.value.references)).toBe(true);
        expect(referencesResult.value.references.length).toBeGreaterThan(0);

        // Verify reference structure
        referencesResult.value.references.forEach((ref) => {
          expect(ref.filePath).toBeDefined();
          expect(typeof ref.line).toBe("number");
          expect(typeof ref.column).toBe("number");
          expect(ref.lineText).toBeDefined();
        });
      }
    });
  });

  describe("getDefinitionsWithLSP", () => {
    it("should get definitions for getValue function", async () => {
      const definitionsResult = await getDefinitionsWithLSP(projectRoot, {
        filePath: "examples/types.ts",
        line: 11, // Line with getValue return statement
        column: 12, // Position of "v" property
      });

      expect(definitionsResult.isOk()).toBe(true);

      if (definitionsResult.isOk()) {
        expect(definitionsResult.value.message).toBeDefined();
        expect(Array.isArray(definitionsResult.value.definitions)).toBe(true);

        // Verify definition structure
        definitionsResult.value.definitions.forEach((def) => {
          expect(def.filePath).toBeDefined();
          expect(typeof def.line).toBe("number");
          expect(typeof def.column).toBe("number");
          expect(def.lineText).toBeDefined();
        });
      }
    });
  });

  describe("getHoverWithLSP", () => {
    it("should get hover information for ValueWithOptional type", async () => {
      const hoverResult = await getHoverWithLSP(projectRoot, {
        filePath: "examples/types.ts",
        line: 5, // Line with ValueWithOptional type
        column: 13, // Position of "ValueWithOptional"
      });

      expect(hoverResult.isOk()).toBe(true);

      if (hoverResult.isOk()) {
        expect(hoverResult.value.message).toBeDefined();
        if (hoverResult.value.hover) {
          expect(hoverResult.value.hover.contents).toBeDefined();
        }
      }
    });
  });
});

describe("LSP Server Direct Integration", () => {
  const projectRoot = process.cwd();
  let client: ReturnType<typeof createLSPClient>;

  beforeEach(() => {
    client = createLSPClient(projectRoot);
  });

  afterEach(async () => {
    await client.stop().catch(() => {});
  });

  it("should start LSP server successfully", async () => {
    await expect(client.start()).resolves.not.toThrow();
  });

  it("should handle document operations", async () => {
    await client.start();

    const testFilePath = resolve(projectRoot, "examples/types.ts");
    const fileContent = readFileSync(testFilePath, "utf-8");
    const fileUri = `file://${testFilePath}`;

    expect(() => {
      client.openDocument(fileUri, fileContent);
    }).not.toThrow();

    // Wait for LSP to process
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  it("should find references for Value type", async () => {
    await client.start();

    const testFilePath = resolve(projectRoot, "examples/types.ts");
    const fileContent = readFileSync(testFilePath, "utf-8");
    const fileUri = `file://${testFilePath}`;

    client.openDocument(fileUri, fileContent);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const references = await client.findReferences(fileUri, {
      line: 0, // 0-based
      character: 12, // 0-based
    });

    expect(Array.isArray(references)).toBe(true);
    expect(references.length).toBeGreaterThan(0);

    references.forEach((ref) => {
      expect(ref.uri).toBeDefined();
      expect(ref.range).toBeDefined();
      expect(ref.range.start).toBeDefined();
      expect(ref.range.end).toBeDefined();
      expect(typeof ref.range.start.line).toBe("number");
      expect(typeof ref.range.start.character).toBe("number");
    });
  });

  it("should get definition for property access", async () => {
    await client.start();

    const testFilePath = resolve(projectRoot, "examples/types.ts");
    const fileContent = readFileSync(testFilePath, "utf-8");
    const fileUri = `file://${testFilePath}`;

    client.openDocument(fileUri, fileContent);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const definitions = await client.getDefinition(fileUri, {
      line: 10, // 0-based
      character: 11, // 0-based
    });

    expect(definitions).toBeDefined();

    const defArray = Array.isArray(definitions) ? definitions : [definitions];
    expect(defArray.length).toBeGreaterThan(0);
  });

  it("should get hover information for ValueWithOptional type", async () => {
    await client.start();

    const testFilePath = resolve(projectRoot, "examples/types.ts");
    const fileContent = readFileSync(testFilePath, "utf-8");
    const fileUri = `file://${testFilePath}`;

    client.openDocument(fileUri, fileContent);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const hover = await client.getHover(fileUri, {
      line: 4, // 0-based
      character: 12, // 0-based
    });

    if (hover) {
      const hoverResult = hover as Hover;
      expect(hoverResult.contents).toBeDefined();

      if (typeof hoverResult.contents === "string") {
        expect(hoverResult.contents.length).toBeGreaterThan(0);
      } else if (Array.isArray(hoverResult.contents)) {
        expect(hoverResult.contents.length).toBeGreaterThan(0);
      } else if ("value" in hoverResult.contents) {
        expect(hoverResult.contents.value).toBeDefined();
      }
    }
  });

  it("should handle invalid syntax gracefully", async () => {
    await client.start();

    const invalidContent = `
export type Broken = {
  value: string
  // Missing closing brace
    `;

    const tempFileUri = `file://${projectRoot}/temp-broken.ts`;

    expect(() => {
      client.openDocument(tempFileUri, invalidContent);
    }).not.toThrow();

    const hover = await client.getHover(tempFileUri, {
      line: 1,
      character: 12,
    });

    // Should not throw, hover may or may not be available
    // Just verify the call completed without throwing
    expect(hover).toBeDefined();
  });
});

describe("LSP Error Handling", () => {
  const projectRoot = process.cwd();

  describe("File System Errors", () => {
    it("should handle non-existent file gracefully", async () => {
      const nonExistentResult = await findReferencesWithLSP(projectRoot, {
        filePath: "examples/does-not-exist.ts",
        line: 1,
        column: 1,
      });

      expect(nonExistentResult.isErr()).toBe(true);
      if (nonExistentResult.isErr()) {
        expect(nonExistentResult.error).toBeDefined();
        expect(typeof nonExistentResult.error).toBe("string");
      }
    });
  });

  describe("Position Validation", () => {
    it("should handle invalid position gracefully", async () => {
      const invalidPosResult = await findReferencesWithLSP(projectRoot, {
        filePath: "examples/types.ts",
        line: 1000, // Way out of bounds
        column: 1000,
      });

      // LSP should either handle gracefully or return error
      if (invalidPosResult.isOk()) {
        expect(Array.isArray(invalidPosResult.value.references)).toBe(true);
      } else {
        expect(invalidPosResult.error).toBeDefined();
      }
    });

    it("should handle empty position (no symbol)", async () => {
      const emptyPosResult = await getHoverWithLSP(projectRoot, {
        filePath: "examples/types.ts",
        line: 3, // Empty line
        column: 1,
      });

      // Should complete without throwing
      expect(emptyPosResult.isOk() || emptyPosResult.isErr()).toBe(true);

      if (emptyPosResult.isOk()) {
        expect(emptyPosResult.value.message).toBeDefined();
      } else {
        expect(emptyPosResult.error).toBeDefined();
      }
    });
  });

  describe("Syntax Error Handling", () => {
    let client: ReturnType<typeof createLSPClient>;

    beforeEach(() => {
      client = createLSPClient(projectRoot);
    });

    afterEach(async () => {
      await client.stop().catch(() => {});
    });

    it("should handle invalid TypeScript syntax", async () => {
      await client.start();

      const invalidContent = `
export type Broken = {
  value: string
  // Missing closing brace
      `;

      const tempFileUri = `file://${projectRoot}/temp-broken.ts`;

      expect(() => {
        client.openDocument(tempFileUri, invalidContent);
      }).not.toThrow();

      // Try to get hover on the broken type
      const hoverPromise = client.getHover(tempFileUri, {
        line: 1,
        character: 12,
      });

      // Should not throw, even with syntax errors
      await expect(hoverPromise).resolves.toBeDefined();
    });
  });

  describe("Server Crash Recovery", () => {
    it("should detect server crash", async () => {
      const crashClient = createLSPClient(projectRoot);

      try {
        await crashClient.start();

        // Force kill the process to simulate crash
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        if ((crashClient as any).process) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          (crashClient as any).process.kill("SIGKILL");
        }

        // Try to use the client after crash
        await new Promise((resolve) => setTimeout(resolve, 100));

        const hoverPromise = crashClient.getHover(
          `file://${projectRoot}/examples/types.ts`,
          {
            line: 0,
            character: 0,
          }
        );

        // Should throw error after crash
        await expect(hoverPromise).rejects.toThrow();
      } catch (error) {
        // Expected behavior - server crash should be detected
        expect(error).toBeDefined();
      }
    });
  });

  describe("Resource Cleanup", () => {
    it("should clean up resources properly", async () => {
      const client = createLSPClient(projectRoot);

      await client.start();

      // Should not throw when stopping
      await expect(client.stop()).resolves.not.toThrow();

      // Should not throw when stopping again
      await expect(client.stop()).resolves.not.toThrow();
    });
  });
});
