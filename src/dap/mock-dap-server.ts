#!/usr/bin/env -S npx tsx
/**
 * Mock DAP server for testing the DAP client implementation
 */
import { createServer, Socket } from "net";
import { EventEmitter } from "events";

class MockDAPServer extends EventEmitter {
  private server: ReturnType<typeof createServer>;
  private sequenceNumber = 1;
  private client: Socket | null = null;

  constructor() {
    super();
    this.server = createServer((socket) => {
      console.log("Client connected");
      this.client = socket;
      this.setupClient(socket);
    });
  }

  private setupClient(socket: Socket) {
    let buffer = "";

    socket.on("data", (data) => {
      buffer += data.toString();

      while (true) {
        const headerEnd = buffer.indexOf("\r\n\r\n");
        if (headerEnd === -1) break;

        const header = buffer.substring(0, headerEnd);
        const contentLengthMatch = header.match(/Content-Length: (\d+)/);
        if (!contentLengthMatch) break;

        const contentLength = parseInt(contentLengthMatch[1], 10);
        const bodyStart = headerEnd + 4;
        const bodyEnd = bodyStart + contentLength;

        if (buffer.length < bodyEnd) break;

        const body = buffer.substring(bodyStart, bodyEnd);
        buffer = buffer.substring(bodyEnd);

        try {
          const message = JSON.parse(body);
          console.log("Received:", message);
          this.handleMessage(message, socket);
        } catch (error) {
          console.error("Failed to parse message:", error);
        }
      }
    });

    socket.on("close", () => {
      console.log("Client disconnected");
      this.client = null;
    });
  }

  private handleMessage(message: any, socket: Socket) {
    switch (message.command) {
      case "initialize":
        this.handleInitialize(message, socket);
        break;
      case "setBreakpoints":
        this.handleSetBreakpoints(message, socket);
        break;
      case "configurationDone":
        this.handleConfigurationDone(message, socket);
        break;
      case "launch":
        this.handleLaunch(message, socket);
        break;
      case "threads":
        this.handleThreads(message, socket);
        break;
      case "continue":
        this.handleContinue(message, socket);
        break;
      case "disconnect":
        this.handleDisconnect(message, socket);
        break;
      default:
        this.sendErrorResponse(
          message,
          socket,
          `Unknown command: ${message.command}`
        );
    }
  }

  private handleInitialize(request: any, socket: Socket) {
    const response = {
      seq: this.sequenceNumber++,
      type: "response",
      request_seq: request.seq,
      success: true,
      command: request.command,
      body: {
        supportsConfigurationDoneRequest: true,
        supportsFunctionBreakpoints: true,
        supportsConditionalBreakpoints: true,
        supportsEvaluateForHovers: true,
        supportsStepBack: false,
        supportsSetVariable: true,
        supportsRestartFrame: false,
        supportsStepInTargetsRequest: false,
        supportsCompletionsRequest: false,
        supportsModulesRequest: false,
      },
    };

    this.sendMessage(response, socket);

    // Send initialized event
    setTimeout(() => {
      this.sendEvent("initialized", {}, socket);
    }, 10);
  }

  private handleSetBreakpoints(request: any, socket: Socket) {
    const breakpoints = request.arguments.breakpoints || [];
    const response = {
      seq: this.sequenceNumber++,
      type: "response",
      request_seq: request.seq,
      success: true,
      command: request.command,
      body: {
        breakpoints: breakpoints.map((bp: any, index: number) => ({
          id: index + 1,
          verified: true,
          line: bp.line,
        })),
      },
    };

    this.sendMessage(response, socket);
  }

  private handleConfigurationDone(request: any, socket: Socket) {
    const response = {
      seq: this.sequenceNumber++,
      type: "response",
      request_seq: request.seq,
      success: true,
      command: request.command,
    };

    this.sendMessage(response, socket);
  }

  private handleLaunch(request: any, socket: Socket) {
    const response = {
      seq: this.sequenceNumber++,
      type: "response",
      request_seq: request.seq,
      success: true,
      command: request.command,
    };

    this.sendMessage(response, socket);

    // Simulate program output
    setTimeout(() => {
      this.sendEvent(
        "output",
        {
          category: "console",
          output: "Starting program...\n",
        },
        socket
      );
    }, 100);

    // Simulate hitting a breakpoint
    setTimeout(() => {
      this.sendEvent(
        "stopped",
        {
          reason: "breakpoint",
          description: "Paused on breakpoint",
          threadId: 1,
          allThreadsStopped: true,
        },
        socket
      );
    }, 200);
  }

  private handleThreads(request: any, socket: Socket) {
    const response = {
      seq: this.sequenceNumber++,
      type: "response",
      request_seq: request.seq,
      success: true,
      command: request.command,
      body: {
        threads: [
          {
            id: 1,
            name: "Main Thread",
          },
        ],
      },
    };

    this.sendMessage(response, socket);
  }

  private handleContinue(request: any, socket: Socket) {
    const response = {
      seq: this.sequenceNumber++,
      type: "response",
      request_seq: request.seq,
      success: true,
      command: request.command,
      body: {
        allThreadsContinued: true,
      },
    };

    this.sendMessage(response, socket);

    // Send continued event
    this.sendEvent(
      "continued",
      {
        threadId: request.arguments.threadId,
        allThreadsContinued: true,
      },
      socket
    );

    // Simulate more output
    setTimeout(() => {
      this.sendEvent(
        "output",
        {
          category: "console",
          output: "fibonacci(0) = 0\nfibonacci(1) = 1\nfibonacci(2) = 1\n",
        },
        socket
      );
    }, 100);

    // Simulate program termination
    setTimeout(() => {
      this.sendEvent("terminated", {}, socket);
    }, 500);
  }

  private handleDisconnect(request: any, socket: Socket) {
    const response = {
      seq: this.sequenceNumber++,
      type: "response",
      request_seq: request.seq,
      success: true,
      command: request.command,
    };

    this.sendMessage(response, socket);
    socket.end();
  }

  private sendErrorResponse(request: any, socket: Socket, message: string) {
    const response = {
      seq: this.sequenceNumber++,
      type: "response",
      request_seq: request.seq,
      success: false,
      command: request.command,
      message,
    };

    this.sendMessage(response, socket);
  }

  private sendEvent(event: string, body: any, socket: Socket) {
    const message = {
      seq: this.sequenceNumber++,
      type: "event",
      event,
      body,
    };

    this.sendMessage(message, socket);
  }

  private sendMessage(message: any, socket: Socket) {
    const json = JSON.stringify(message);
    const contentLength = Buffer.byteLength(json, "utf8");
    const response = `Content-Length: ${contentLength}\r\n\r\n${json}`;

    console.log("Sending:", message);
    socket.write(response);
  }

  listen(port: number) {
    this.server.listen(port, () => {
      console.log(`Mock DAP server listening on port ${port}`);
    });
  }

  close() {
    this.server.close();
  }
}

// Start the server
const server = new MockDAPServer();
server.listen(58080);

console.log("Mock DAP server started on port 58080");
console.log("Press Ctrl+C to stop");

process.on("SIGINT", () => {
  console.log("\nShutting down...");
  server.close();
  process.exit(0);
});