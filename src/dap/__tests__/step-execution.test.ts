#!/usr/bin/env -S npx tsx
/**
 * Test for DAP step execution capabilities
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
  public currentThreadId: number | null = null;

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
        if (message.event === "stopped" && message.body.threadId) {
          this.currentThreadId = message.body.threadId;
        }
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

// Test step execution
async function testStepExecution() {
  const client = new TestDAPClient();
  
  console.log("👣 Step Execution Test");
  console.log("=====================\n");

  let stepCount = 0;
  const maxSteps = 4;

  // Track execution flow
  client.on("stopped", async (event) => {
    stepCount++;
    console.log(`\n🛑 Stopped #${stepCount}: ${event.reason}`);
    
    if (event.description) {
      console.log(`   Description: ${event.description}`);
    }

    // Get current location
    try {
      const stackTrace = await client.sendRequest("stackTrace", { 
        threadId: client.currentThreadId 
      });
      
      if (stackTrace.stackFrames.length > 0) {
        const frame = stackTrace.stackFrames[0];
        console.log(`   Location: ${frame.name} at line ${frame.line}`);
      }
    } catch (error) {
      console.log("   Could not get stack trace");
    }

    // Perform different step operations
    if (stepCount < maxSteps && client.currentThreadId) {
      setTimeout(async () => {
        try {
          switch (stepCount) {
            case 1:
              console.log("\n➡️  Performing STEP OVER...");
              await client.sendRequest("next", { 
                threadId: client.currentThreadId 
              });
              break;
              
            case 2:
              console.log("\n⬇️  Performing STEP INTO...");
              await client.sendRequest("stepIn", { 
                threadId: client.currentThreadId 
              });
              break;
              
            case 3:
              console.log("\n⬆️  Performing STEP OUT...");
              await client.sendRequest("stepOut", { 
                threadId: client.currentThreadId 
              });
              break;
              
            default:
              console.log("\n▶️  Continuing execution...");
              await client.sendRequest("continue", { 
                threadId: client.currentThreadId 
              });
          }
        } catch (error) {
          console.error("Step operation failed:", error);
        }
      }, 500);
    }
  });

  client.on("output", (event) => {
    console.log(`📝 Output: ${event.output.trim()}`);
  });

  client.on("terminated", () => {
    console.log("\n🏁 Program terminated");
  });

  try {
    await client.connect(58080);
    console.log("✅ Connected to DAP server");

    // Initialize
    await client.sendRequest("initialize", {
      clientID: "step-test",
      linesStartAt1: true,
      columnsStartAt1: true,
    });

    await new Promise<void>((resolve) => {
      client.once("initialized", resolve);
    });

    // Set multiple breakpoints for stepping
    console.log("\n🔴 Setting breakpoints for step testing...");
    await client.sendRequest("setBreakpoints", {
      source: { path: "/test/program.js" },
      breakpoints: [
        { line: 24 },  // In complexFunction
        { line: 8 },   // In calculateSum
      ],
    });
    
    await client.sendRequest("configurationDone");

    console.log("🚀 Launching program...");
    await client.sendRequest("launch", { 
      program: "/test/program.js" 
    });

    // Wait for program to complete
    await new Promise<void>((resolve) => {
      client.once("terminated", () => {
        setTimeout(resolve, 100);
      });
    });

    console.log("\n📊 Step Execution Summary:");
    console.log(`   Total stops: ${stepCount}`);
    console.log(`   Step operations performed: ${Math.min(stepCount - 1, 3)}`);
    console.log("   - Step Over (next)");
    console.log("   - Step Into (stepIn)");
    console.log("   - Step Out (stepOut)");

    await client.sendRequest("disconnect");
    console.log("\n✅ Step execution test completed!");

  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    client.disconnect();
  }
}

// Run test
if (require.main === module) {
  console.log("Make sure enhanced-mock-dap-server.ts is running on port 58080\n");
  testStepExecution().catch(console.error);
}