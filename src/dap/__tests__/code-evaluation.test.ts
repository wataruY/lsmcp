#!/usr/bin/env -S npx tsx
/**
 * Test for DAP code evaluation (REPL) capabilities
 */
import { Socket } from "net";
import { EventEmitter } from "events";

// Simplified test client
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
    if (!contentLengthMatch) return null;

    const contentLength = parseInt(contentLengthMatch[1], 10);
    const bodyStart = headerEndIndex + 4;
    const bodyEnd = bodyStart + contentLength;

    if (this.buffer.length < bodyEnd) return null;

    const body = this.buffer.substring(bodyStart, bodyEnd);
    this.buffer = this.buffer.substring(bodyEnd);

    return JSON.parse(body);
  }

  private handleMessage(message: any): void {
    switch (message.type) {
      case "response":
        this.handleResponse(message);
        break;
      case "event":
        this.emit(message.event, message.body);
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

// Test code evaluation
async function testCodeEvaluation() {
  const client = new TestDAPClient();
  
  console.log("💻 Code Evaluation Test");
  console.log("======================\n");

  try {
    await client.connect(58080);
    console.log("✅ Connected to DAP server");

    // Initialize and setup
    await client.sendRequest("initialize", {
      clientID: "eval-test",
      supportsEvaluateForHovers: true,
    });

    await new Promise<void>((resolve) => {
      client.once("initialized", resolve);
    });

    await client.sendRequest("setBreakpoints", {
      source: { path: "/test/program.js" },
      breakpoints: [{ line: 10 }],
    });
    
    await client.sendRequest("configurationDone");
    await client.sendRequest("launch", { program: "/test/program.js" });

    // Wait for breakpoint
    await new Promise<void>((resolve) => {
      client.once("stopped", resolve);
    });

    // Get frame ID for evaluation context
    const stackTrace = await client.sendRequest("stackTrace", { threadId: 1 });
    const frameId = stackTrace.stackFrames[0].id;

    console.log("\n🧪 Testing Expression Evaluation:\n");

    // Test various expressions
    const testExpressions = [
      // Arithmetic
      { expr: "1 + 1", desc: "Simple arithmetic" },
      { expr: "10 * 5 - 8", desc: "Complex arithmetic" },
      
      // Variables
      { expr: "numbers", desc: "Array variable" },
      { expr: "numbers.length", desc: "Array property" },
      { expr: "numbers[0]", desc: "Array element" },
      
      // Objects
      { expr: "obj", desc: "Object variable" },
      { expr: "obj.name", desc: "Object property" },
      { expr: "obj.nested.deep", desc: "Nested property" },
      
      // Type checks
      { expr: "typeof globalVar", desc: "Type check" },
      { expr: "Array.isArray(numbers)", desc: "Array check" },
      
      // Invalid expressions
      { expr: "undefinedVar", desc: "Undefined variable" },
      { expr: "1 +", desc: "Syntax error" },
    ];

    for (const test of testExpressions) {
      try {
        const result = await client.sendRequest("evaluate", {
          expression: test.expr,
          frameId,
          context: "repl",
        });
        
        console.log(`✅ ${test.desc}:`);
        console.log(`   ${test.expr} => ${result.result}`);
        
        if (result.type) {
          console.log(`   Type: ${result.type}`);
        }
        
        if (result.variablesReference > 0) {
          console.log(`   Has nested values (ref: ${result.variablesReference})`);
        }
      } catch (error) {
        console.log(`❌ ${test.desc}:`);
        console.log(`   ${test.expr} => ERROR: ${error instanceof Error ? error.message : error}`);
      }
      console.log("");
    }

    // Test evaluation in different contexts
    console.log("🎭 Testing Evaluation Contexts:\n");
    
    const contexts = ["repl", "watch", "hover"];
    for (const context of contexts) {
      try {
        const result = await client.sendRequest("evaluate", {
          expression: "obj.value",
          frameId,
          context,
        });
        console.log(`✅ Context '${context}': obj.value => ${result.result}`);
      } catch (error) {
        console.log(`❌ Context '${context}': ERROR`);
      }
    }

    await client.sendRequest("disconnect");
    console.log("\n✅ Code evaluation test completed!");

  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    client.disconnect();
  }
}

// Run test
if (require.main === module) {
  console.log("Make sure enhanced-mock-dap-server.ts is running on port 58080\n");
  testCodeEvaluation().catch(console.error);
}