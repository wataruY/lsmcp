#!/usr/bin/env -S npx tsx
/**
 * Advanced DAP test with variable inspection, code evaluation, and step execution
 */
import { Socket } from "net";
import { EventEmitter } from "events";
import { writeFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Enhanced DAP client with debugging features
class DebugDAPClient extends EventEmitter {
  private socket: Socket;
  private sequenceNumber = 1;
  private pendingRequests = new Map<
    number,
    {
      resolve: (response: any) => void;
      reject: (error: Error) => void;
    }
  >();
  private buffer = "";
  
  // State tracking
  private currentThreadId: number | null = null;
  private currentFrameId: number | null = null;

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

        console.log("[Client] Received:", JSON.stringify(message, null, 2));
        this.handleMessage(message);
      }
    });

    this.socket.on("error", (error) => {
      console.error("[Client] Socket error:", error);
      this.emit("error", error);
    });

    this.socket.on("close", () => {
      console.log("[Client] Socket closed");
      this.emit("close");
    });
  }

  async connect(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.connect(port, "localhost", () => {
        console.log(`[Client] Connected to localhost:${port}`);
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

    console.log("[Client] Sending:", message.command);
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
        // Track thread and frame IDs for convenience
        if (message.event === "stopped" && message.body.threadId) {
          this.currentThreadId = message.body.threadId;
        }
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

  // Helper methods for debugging operations
  async getStackTrace(threadId?: number): Promise<any> {
    const tid = threadId || this.currentThreadId;
    if (!tid) throw new Error("No thread ID available");
    
    const result = await this.sendRequest("stackTrace", { threadId: tid });
    if (result.stackFrames && result.stackFrames.length > 0) {
      this.currentFrameId = result.stackFrames[0].id;
    }
    return result;
  }

  async getScopes(frameId?: number): Promise<any> {
    const fid = frameId || this.currentFrameId;
    if (!fid) throw new Error("No frame ID available");
    
    return this.sendRequest("scopes", { frameId: fid });
  }

  async getVariables(variablesReference: number): Promise<any> {
    return this.sendRequest("variables", { variablesReference });
  }

  async evaluate(expression: string, frameId?: number, context: string = "repl"): Promise<any> {
    return this.sendRequest("evaluate", {
      expression,
      frameId: frameId || this.currentFrameId,
      context,
    });
  }

  async stepOver(threadId?: number): Promise<any> {
    const tid = threadId || this.currentThreadId;
    if (!tid) throw new Error("No thread ID available");
    
    return this.sendRequest("next", { threadId: tid });
  }

  async stepIn(threadId?: number): Promise<any> {
    const tid = threadId || this.currentThreadId;
    if (!tid) throw new Error("No thread ID available");
    
    return this.sendRequest("stepIn", { threadId: tid });
  }

  async stepOut(threadId?: number): Promise<any> {
    const tid = threadId || this.currentThreadId;
    if (!tid) throw new Error("No thread ID available");
    
    return this.sendRequest("stepOut", { threadId: tid });
  }

  async continue(threadId?: number): Promise<any> {
    const tid = threadId || this.currentThreadId;
    if (!tid) throw new Error("No thread ID available");
    
    return this.sendRequest("continue", { threadId: tid });
  }

  disconnect(): void {
    this.socket.end();
  }
}

// Create test program with more complex structure
const testProgram = resolve(__dirname, "advanced-test-program.js");
writeFileSync(
  testProgram,
  `
// Test program for advanced DAP features
const globalVar = "I'm global";

function calculateSum(arr) {
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];  // Breakpoint here
  }
  return sum;
}

function complexFunction() {
  const localVar = "I'm local";
  const numbers = [1, 2, 3, 4, 5];
  const obj = {
    name: "Test Object",
    value: 42,
    nested: {
      deep: "Deep value"
    }
  };
  
  console.log("Before calculation");
  const result = calculateSum(numbers); // Breakpoint here
  console.log("Sum is:", result);
  
  return { result, obj };
}

// Main execution
console.log("Starting advanced debug test...");
const output = complexFunction();
console.log("Finished with output:", output);
`
);

// Test the advanced features
async function testAdvancedDebugging() {
  const client = new DebugDAPClient();

  // Set up event listeners
  client.on("initialized", () => {
    console.log("✅ [Test] Initialized");
  });

  let stoppedCount = 0;
  client.on("stopped", async (event) => {
    stoppedCount++;
    console.log(`\n⏸️  [Test] Stopped #${stoppedCount}:`, event.reason);
    
    try {
      // Get stack trace
      console.log("\n📚 Getting stack trace...");
      const stackTrace = await client.getStackTrace();
      console.log("Stack frames:");
      stackTrace.stackFrames.forEach((frame: any, index: number) => {
        console.log(`  ${index}: ${frame.name} at ${frame.source?.path}:${frame.line}`);
      });

      // Get scopes
      console.log("\n🔍 Getting scopes...");
      const scopes = await client.getScopes();
      console.log("Available scopes:");
      
      for (const scope of scopes.scopes) {
        console.log(`\n  📦 ${scope.name}:`);
        
        // Get variables for each scope
        const variables = await client.getVariables(scope.variablesReference);
        for (const variable of variables.variables) {
          console.log(`    ${variable.name} = ${variable.value} (${variable.type || 'unknown type'})`);
          
          // If it's an object/array, get nested values
          if (variable.variablesReference > 0) {
            const nested = await client.getVariables(variable.variablesReference);
            for (const nestedVar of nested.variables) {
              console.log(`      .${nestedVar.name} = ${nestedVar.value}`);
            }
          }
        }
      }

      // Evaluate expressions
      console.log("\n💻 Evaluating expressions:");
      const expressions = [
        "1 + 1",
        "numbers",
        "numbers.length",
        "obj.nested.deep",
        "typeof globalVar",
      ];
      
      for (const expr of expressions) {
        try {
          const result = await client.evaluate(expr);
          console.log(`  ${expr} => ${result.result}`);
        } catch (error) {
          console.log(`  ${expr} => ERROR: ${error instanceof Error ? error.message : error}`);
        }
      }

      // Decide what to do based on stop count
      if (stoppedCount === 1) {
        console.log("\n➡️  Stepping over...");
        await client.stepOver();
      } else if (stoppedCount === 2) {
        console.log("\n⬇️  Stepping into calculateSum...");
        await client.stepIn();
      } else if (stoppedCount === 3) {
        console.log("\n⬆️  Stepping out of calculateSum...");
        await client.stepOut();
      } else {
        console.log("\n▶️  Continuing execution...");
        await client.continue();
      }
    } catch (error) {
      console.error("Error during stopped event handling:", error);
    }
  });

  client.on("output", (event) => {
    console.log(`📝 Output [${event.category}]: ${event.output.trim()}`);
  });

  client.on("terminated", () => {
    console.log("\n🛑 Program terminated");
  });

  try {
    // Connect to mock server
    console.log("🔌 Connecting to DAP server...");
    await client.connect(58080);

    // Initialize
    console.log("🚀 Initializing...");
    await client.sendRequest("initialize", {
      clientID: "advanced-test",
      clientName: "Advanced Test Client",
      adapterID: "mock",
      linesStartAt1: true,
      columnsStartAt1: true,
      supportsVariableType: true,
      supportsVariablePaging: true,
      supportsEvaluateForHovers: true,
    });

    // Wait for initialized
    await new Promise<void>((resolve) => {
      client.once("initialized", resolve);
    });

    // Set breakpoints
    console.log("🔴 Setting breakpoints...");
    await client.sendRequest("setBreakpoints", {
      source: { path: testProgram },
      breakpoints: [
        { line: 8 },   // Inside calculateSum loop
        { line: 24 },  // Before calculateSum call
      ],
    });

    // Configuration done
    await client.sendRequest("configurationDone");

    // Launch
    console.log("🚀 Launching program...");
    await client.sendRequest("launch", {
      program: testProgram,
    });

    // Wait for termination
    await new Promise<void>((resolve) => {
      client.once("terminated", resolve);
    });

    // Disconnect
    console.log("\n🔌 Disconnecting...");
    await client.sendRequest("disconnect");

    console.log("\n✅ Advanced debugging test completed!");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    client.disconnect();
  }
}

// Run the test
console.log("Advanced DAP Client Test");
console.log("Make sure the mock DAP server is running on port 58080");
console.log("==================================================\n");

testAdvancedDebugging().catch(console.error);