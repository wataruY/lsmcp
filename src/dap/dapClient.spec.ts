import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DAPClient } from "./dapClient.ts";
import { EnhancedMockDAPServer } from "./__tests__/test-helpers/enhanced-mock-dap-server.ts";

describe("DAP Client", () => {
  let server: EnhancedMockDAPServer;
  const port = 58081;

  beforeAll(async () => {
    server = new EnhancedMockDAPServer();
    await new Promise<void>((resolve) => {
      server.listen(port, resolve);
    });
  });

  afterAll(() => {
    server.close();
  });

  describe("Basic Connection", () => {
    it("should connect to DAP server", async () => {
      const client = new DAPClient();
      
      await client.connect("tcp", [`localhost:${port}`]);
      
      const initResponse = await client.initialize({
        clientID: "test-client",
        clientName: "Test Client",
        adapterID: "mock",
        linesStartAt1: true,
        columnsStartAt1: true,
      });

      expect(initResponse).toBeDefined();
      expect(initResponse.supportsConfigurationDoneRequest).toBe(true);
      
      client.disconnect();
    });

    it("should handle events", async () => {
      const client = new DAPClient();
      await client.connect("tcp", [`localhost:${port}`]);

      const events: string[] = [];
      client.on("initialized", () => {
        events.push("initialized");
      });

      await client.initialize();
      
      // Wait for initialized event
      await new Promise((resolve) => setTimeout(resolve, 50));
      
      expect(events).toContain("initialized");
      client.disconnect();
    });
  });

  describe("Breakpoint Management", () => {
    it("should set and verify breakpoints", async () => {
      const client = new DAPClient();
      await client.connect("tcp", [`localhost:${port}`]);
      await client.initialize();

      const response = await client.sendRequest("setBreakpoints", {
        source: { path: "/test/file.js" },
        breakpoints: [{ line: 10 }, { line: 20 }],
      });

      expect(response.breakpoints).toHaveLength(2);
      expect(response.breakpoints[0].verified).toBe(true);
      expect(response.breakpoints[0].line).toBe(10);
      expect(response.breakpoints[1].verified).toBe(true);
      expect(response.breakpoints[1].line).toBe(20);

      client.disconnect();
    });
  });
});