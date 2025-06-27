#!/usr/bin/env -S npx tsx
/**
 * Test for DAP variable inspection capabilities
 */
import { Socket } from "net";
import { EventEmitter } from "events";

// Import the test client from full test
class TestDAPClient extends EventEmitter {
  private socket: Socket;
  private sequenceNumber = 1;
  private pendingRequests = new Map<number, {
    resolve: (response: any) => void;
    reject: (error: Error) => void;
  }>();
  private buffer = "";

  constructor() {
    super();
    this.socket = new Socket();
    this.setupSocket();
  }

  private setupSocket() {
    this.socket.on("data", (data) => {
      this.buffer += data.toString();
      while (true) {
        const message = this.tryParseMessage();
        if (!message) break;
        this.handleMessage(message);
      }
    });

    this.socket.on("error", (error) => {
      this.emit("error", error);
    });

    this.socket.on("close", () => {
      this.emit("close");
    });
  }

  async connect(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.connect(port, "localhost", () => {
        resolve();
      });
      this.socket.once("error", reject);
    });
  }

  async sendRequest<T = any>(command: string, args?: any): Promise<T> {
    const seq = this.sequenceNumber++;
    const request = {
      seq,
      type: "request",
      command,
      arguments: args,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(seq, { resolve, reject });
      this.sendMessage(request);

      setTimeout(() => {
        if (this.pendingRequests.has(seq)) {
          this.pendingRequests.delete(seq);
          reject(new Error(`Request timeout: ${command}`));
        }
      }, 5000);
    });
  }

  private sendMessage(message: any): void {
    const json = JSON.stringify(message);
    const contentLength = Buffer.byteLength(json, "utf8");
    const header = `Content-Length: ${contentLength}\r\n\r\n`;
    this.socket.write(header + json);
  }

  private tryParseMessage(): any | null {
    const headerEndIndex = this.buffer.indexOf("\r\n\r\n");
    if (headerEndIndex === -1) return null;

    const header = this.buffer.substring(0, headerEndIndex);
    const contentLengthMatch = header.match(/Content-Length: (\d+)/);
    if (!contentLengthMatch) {
      throw new Error("Invalid header: missing Content-Length");
    }

    const contentLength = parseInt(contentLengthMatch[1], 10);
    const bodyStart = headerEndIndex + 4;
    const bodyEnd = bodyStart + contentLength;

    if (this.buffer.length < bodyEnd) return null;

    const body = this.buffer.substring(bodyStart, bodyEnd);
    this.buffer = this.buffer.substring(bodyEnd);

    try {
      return JSON.parse(body);
    } catch {
      throw new Error(`Failed to parse message body: ${body}`);
    }
  }

  private handleMessage(message: any): void {
    switch (message.type) {
      case "response":
        this.handleResponse(message);
        break;
      case "event":
        this.emit(message.event, message.body);
        this.emit("event", message);
        break;
    }
  }

  private handleResponse(response: any): void {
    const pending = this.pendingRequests.get(response.request_seq);
    if (!pending) return;

    this.pendingRequests.delete(response.request_seq);

    if (response.success) {
      pending.resolve(response.body);
    } else {
      pending.reject(new Error(response.message || "Request failed"));
    }
  }

  disconnect(): void {
    this.socket.end();
  }
}

// Test variable inspection
async function testVariableInspection() {
  const client = new TestDAPClient();
  
  console.log("🔬 Variable Inspection Test");
  console.log("==========================\n");

  try {
    await client.connect(58080);
    console.log("✅ Connected to DAP server");

    // Initialize
    await client.sendRequest("initialize", {
      clientID: "variable-test",
      linesStartAt1: true,
      columnsStartAt1: true,
      supportsVariableType: true,
    });

    await new Promise<void>((resolve) => {
      client.once("initialized", resolve);
    });

    // Setup and launch
    await client.sendRequest("setBreakpoints", {
      source: { path: "/test/program.js" },
      breakpoints: [{ line: 10 }],
    });
    
    await client.sendRequest("configurationDone");
    await client.sendRequest("launch", { program: "/test/program.js" });

    // Wait for stop
    await new Promise<void>((resolve) => {
      client.once("stopped", resolve);
    });

    console.log("\n📊 Testing Variable Inspection:");

    // Get stack trace
    const stackTrace = await client.sendRequest("stackTrace", { threadId: 1 });
    const frameId = stackTrace.stackFrames[0].id;

    // Get scopes
    const scopes = await client.sendRequest("scopes", { frameId });
    console.log("\n📦 Available Scopes:");
    scopes.scopes.forEach((scope: any) => {
      console.log(`  - ${scope.name} (ref: ${scope.variablesReference})`);
    });

    // Get variables for each scope
    for (const scope of scopes.scopes) {
      console.log(`\n🔍 Variables in ${scope.name}:`);
      const variables = await client.sendRequest("variables", {
        variablesReference: scope.variablesReference,
      });

      variables.variables.forEach((v: any) => {
        console.log(`  ${v.name} = ${v.value} (${v.type || 'unknown'})`);
        
        // Test nested variables
        if (v.variablesReference > 0) {
          console.log(`    → Has nested values (ref: ${v.variablesReference})`);
        }
      });
    }

    // Test specific nested variable
    const localScope = scopes.scopes.find((s: any) => s.name === "Locals");
    if (localScope) {
      const vars = await client.sendRequest("variables", {
        variablesReference: localScope.variablesReference,
      });
      
      const objVar = vars.variables.find((v: any) => v.name === "obj");
      if (objVar && objVar.variablesReference > 0) {
        console.log(`\n🔍 Nested object properties:`);
        const nested = await client.sendRequest("variables", {
          variablesReference: objVar.variablesReference,
        });
        nested.variables.forEach((v: any) => {
          console.log(`  obj.${v.name} = ${v.value}`);
        });
      }
    }

    await client.sendRequest("disconnect");
    console.log("\n✅ Variable inspection test completed!");

  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    client.disconnect();
  }
}

// Run test
if (require.main === module) {
  console.log("Make sure enhanced-mock-dap-server.ts is running on port 58080\n");
  testVariableInspection().catch(console.error);
}