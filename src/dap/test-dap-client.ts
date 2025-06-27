#!/usr/bin/env -S npx tsx
/**
 * Test the DAP client with the mock server
 */
import { Socket } from "net";
import { EventEmitter } from "events";

// Simple DAP client using TCP socket
class SimpleDAPClient extends EventEmitter {
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

        console.log("[Client] Received:", message);
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

      // Timeout after 5 seconds
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

    console.log("[Client] Sending:", message);
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
    } catch (error) {
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

// Test the client
async function testClient() {
  const client = new SimpleDAPClient();

  // Set up event listeners
  client.on("initialized", () => {
    console.log("✅ [Test] Initialized event received");
  });

  client.on("stopped", (event) => {
    console.log("⏸️  [Test] Stopped:", event);
  });

  client.on("output", (event) => {
    console.log(`📝 [Test] Output [${event.category}]:`, event.output.trim());
  });

  client.on("terminated", () => {
    console.log("🛑 [Test] Terminated");
  });

  client.on("continued", (event) => {
    console.log("▶️  [Test] Continued:", event);
  });

  try {
    // Connect to mock server
    console.log("🔌 [Test] Connecting to mock DAP server...");
    await client.connect(58080);

    // Initialize
    console.log("🚀 [Test] Sending initialize request...");
    const initResponse = await client.sendRequest("initialize", {
      clientID: "test-client",
      clientName: "Test Client",
      adapterID: "mock",
      linesStartAt1: true,
      columnsStartAt1: true,
    });
    console.log("✅ [Test] Initialize response:", initResponse);

    // Wait for initialized event
    await new Promise<void>((resolve) => {
      client.once("initialized", resolve);
    });

    // Set breakpoints
    console.log("🔴 [Test] Setting breakpoints...");
    const bpResponse = await client.sendRequest("setBreakpoints", {
      source: { path: "/test/program.js" },
      breakpoints: [{ line: 5 }, { line: 10 }],
    });
    console.log("✅ [Test] Breakpoints response:", bpResponse);

    // Configuration done
    console.log("✅ [Test] Sending configurationDone...");
    await client.sendRequest("configurationDone");

    // Launch
    console.log("🚀 [Test] Launching program...");
    await client.sendRequest("launch", {
      program: "/test/program.js",
    });

    // Wait for stopped event
    await new Promise<void>((resolve) => {
      client.once("stopped", resolve);
    });

    // Get threads
    console.log("🧵 [Test] Getting threads...");
    const threads = await client.sendRequest("threads");
    console.log("✅ [Test] Threads:", threads);

    // Continue
    console.log("▶️  [Test] Continuing execution...");
    await client.sendRequest("continue", {
      threadId: 1,
    });

    // Wait for terminated event
    await new Promise<void>((resolve) => {
      client.once("terminated", resolve);
    });

    // Disconnect
    console.log("🔌 [Test] Disconnecting...");
    await client.sendRequest("disconnect");

    console.log("\n✅ [Test] All tests passed!");
  } catch (error) {
    console.error("❌ [Test] Error:", error);
  } finally {
    client.disconnect();
  }
}

// Run the test
console.log("Starting DAP client test...");
console.log("Make sure the mock DAP server is running (run mock-dap-server.ts)");
console.log("");

testClient().catch(console.error);