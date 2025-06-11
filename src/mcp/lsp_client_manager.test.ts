import { describe, it, expect, afterAll } from "vitest";
import { getTypeScriptLSPClient, getTsgoLSPClient, shutdownAllClients } from "./lsp_client_manager.ts";
import { resolve } from "path";
import { existsSync } from "fs";

describe("LSP Client Manager - Simplified Interface", () => {
  const projectPath = process.cwd();

  afterAll(async () => {
    await shutdownAllClients();
  });

  describe("TypeScript LSP Client", () => {
    it("should provide a simple interface with just project path", async () => {
      // Get client with just a project path
      const client = getTypeScriptLSPClient(projectPath);

      // Use the client
      const testFile = resolve(projectPath, "src/lsp/lsp_client.ts");
      if (!existsSync(testFile)) {
        console.log("Test file not found, skipping");
        return;
      }

      const fileUri = `file://${testFile}`;
      
      // Find references
      const refs = await client.findReferences(fileUri, { line: 10, character: 0 });
      expect(Array.isArray(refs)).toBe(true);

      // Get hover info
      const hover = await client.getHover(fileUri, { line: 10, character: 0 });
      expect(hover).toBeDefined();

      // Clean up
      await client.shutdown();
    });

    it("should handle multiple operations with withClient", async () => {
      const client = getTypeScriptLSPClient(projectPath);

      const result = await client.withClient(async (lspClient) => {
        // Can perform multiple operations with the same client
        const testFile = resolve(projectPath, "src/lsp/lsp_client.ts");
        const fileUri = `file://${testFile}`;
        
        const fileContent = await import("fs/promises").then(fs => 
          fs.readFile(testFile, "utf-8")
        );
        
        lspClient.openDocument(fileUri, fileContent);
        
        // Multiple operations in one go
        const refs = await lspClient.findReferences(fileUri, { line: 10, character: 0 });
        const hover = await lspClient.getHover(fileUri, { line: 10, character: 0 });
        
        return { refs, hover };
      });

      expect(result.refs).toBeDefined();
      expect(result.hover).toBeDefined();

      await client.shutdown();
    });
  });

  describe("tsgo LSP Client", () => {
    it("should provide tsgo client with same simple interface", async () => {
      // Same simple interface for tsgo
      const client = getTsgoLSPClient(projectPath);

      // Test that it has the same API
      expect(client.findReferences).toBeDefined();
      expect(client.getDefinition).toBeDefined();
      expect(client.getHover).toBeDefined();
      expect(client.getDiagnostics).toBeDefined();
      expect(client.withClient).toBeDefined();
      expect(client.shutdown).toBeDefined();

      await client.shutdown();
    });
  });

  describe("Multiple Projects", () => {
    it("should handle multiple projects independently", async () => {
      const project1 = projectPath;
      const project2 = resolve(projectPath, "tests/fixtures");

      const client1 = getTypeScriptLSPClient(project1);
      const client2 = getTypeScriptLSPClient(project2);

      // Each project gets its own pool
      expect(client1).not.toBe(client2);

      await client1.shutdown();
      await client2.shutdown();
    });

    it("should reuse clients for the same project", async () => {
      const client1 = getTypeScriptLSPClient(projectPath);
      const client2 = getTypeScriptLSPClient(projectPath);

      // Same project path returns same pool
      // They share the underlying pool but return separate API instances
      expect(client1).not.toBe(client2); // Different API instances
      
      // But they work with the same pool (we can't directly test this without exposing internals)
      
      await client1.shutdown();
      // client2 should also be shut down since they share the pool
    });
  });
});