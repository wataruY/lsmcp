#!/usr/bin/env -S npx tsx
/**
 * Enhanced Mock DAP server with variable inspection, evaluation, and stepping support
 */
import { createServer, Socket } from "net";
import { EventEmitter } from "events";

// Mock program state
interface ProgramState {
  stopped: boolean;
  threadId: number;
  frameId: number;
  stopReason: string;
  currentLine: number;
  variables: Map<string, any>;
  scopes: Array<{
    name: string;
    variablesReference: number;
    expensive: boolean;
  }>;
}

class EnhancedMockDAPServer extends EventEmitter {
  private server: ReturnType<typeof createServer>;
  private sequenceNumber = 1;
  private variableHandles = new Map<number, any>();
  private nextVariableReference = 1000;
  
  // Program state
  private programState: ProgramState = {
    stopped: false,
    threadId: 1,
    frameId: 1,
    stopReason: "",
    currentLine: 0,
    variables: new Map(),
    scopes: [],
  };

  constructor() {
    super();
    this.server = createServer((socket) => {
      console.log("Client connected");
      this.setupClient(socket);
    });
    
    this.initializeMockState();
  }

  private initializeMockState() {
    // Set up mock variables for different scopes
    this.programState.variables.set("globalVar", "I'm global");
    
    // Mock local scope
    const localVars = {
      localVar: "I'm local",
      numbers: [1, 2, 3, 4, 5],
      obj: {
        name: "Test Object",
        value: 42,
        nested: {
          deep: "Deep value"
        }
      },
      i: 0,
      sum: 0,
      arr: [1, 2, 3, 4, 5],
    };
    
    // Store variables with references
    this.variableHandles.set(1, this.programState.variables);
    this.variableHandles.set(2, localVars);
    this.variableHandles.set(3, localVars.numbers);
    this.variableHandles.set(4, localVars.obj);
    this.variableHandles.set(5, localVars.obj.nested);
    this.variableHandles.set(6, localVars.arr);
    
    // Set up scopes
    this.programState.scopes = [
      { name: "Locals", variablesReference: 2, expensive: false },
      { name: "Globals", variablesReference: 1, expensive: false },
    ];
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
          console.log("Received:", message.command);
          this.handleMessage(message, socket);
        } catch (error) {
          console.error("Failed to parse message:", error);
        }
      }
    });

    socket.on("close", () => {
      console.log("Client disconnected");
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
      case "stackTrace":
        this.handleStackTrace(message, socket);
        break;
      case "scopes":
        this.handleScopes(message, socket);
        break;
      case "variables":
        this.handleVariables(message, socket);
        break;
      case "evaluate":
        this.handleEvaluate(message, socket);
        break;
      case "continue":
        this.handleContinue(message, socket);
        break;
      case "next":
        this.handleNext(message, socket);
        break;
      case "stepIn":
        this.handleStepIn(message, socket);
        break;
      case "stepOut":
        this.handleStepOut(message, socket);
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
        supportsDelayedStackTraceLoading: false,
        supportsLoadedSourcesRequest: false,
        supportsLogPoints: false,
        supportsTerminateThreadsRequest: false,
        supportsSetExpression: false,
        supportsTerminateRequest: false,
        supportsDataBreakpoints: false,
        supportsReadMemoryRequest: false,
        supportsWriteMemoryRequest: false,
        supportsDisassembleRequest: false,
        supportsCancelRequest: false,
        supportsBreakpointLocationsRequest: false,
        supportsClipboardContext: false,
        supportsSteppingGranularity: false,
        supportsInstructionBreakpoints: false,
        supportsExceptionFilterOptions: false,
      },
    };

    this.sendMessage(response, socket);

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

    // Simulate program start
    setTimeout(() => {
      this.sendEvent(
        "output",
        {
          category: "console",
          output: "Starting advanced debug test...\n",
        },
        socket
      );
    }, 100);

    // Hit first breakpoint
    setTimeout(() => {
      this.programState.stopped = true;
      this.programState.stopReason = "breakpoint";
      this.programState.currentLine = 24;
      
      this.sendEvent(
        "stopped",
        {
          reason: "breakpoint",
          description: "Paused on breakpoint",
          threadId: this.programState.threadId,
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
            id: this.programState.threadId,
            name: "Main Thread",
          },
        ],
      },
    };

    this.sendMessage(response, socket);
  }

  private handleStackTrace(request: any, socket: Socket) {
    const frames = [];
    
    if (this.programState.currentLine === 24) {
      frames.push(
        {
          id: 1,
          name: "complexFunction",
          source: { path: "/test/advanced-test-program.js" },
          line: 24,
          column: 0,
        },
        {
          id: 2,
          name: "module code",
          source: { path: "/test/advanced-test-program.js" },
          line: 32,
          column: 0,
        }
      );
    } else if (this.programState.currentLine === 8) {
      frames.push(
        {
          id: 1,
          name: "calculateSum",
          source: { path: "/test/advanced-test-program.js" },
          line: 8,
          column: 0,
        },
        {
          id: 2,
          name: "complexFunction",
          source: { path: "/test/advanced-test-program.js" },
          line: 24,
          column: 0,
        },
        {
          id: 3,
          name: "module code",
          source: { path: "/test/advanced-test-program.js" },
          line: 32,
          column: 0,
        }
      );
    }

    const response = {
      seq: this.sequenceNumber++,
      type: "response",
      request_seq: request.seq,
      success: true,
      command: request.command,
      body: {
        stackFrames: frames,
        totalFrames: frames.length,
      },
    };

    this.sendMessage(response, socket);
  }

  private handleScopes(request: any, socket: Socket) {
    const response = {
      seq: this.sequenceNumber++,
      type: "response",
      request_seq: request.seq,
      success: true,
      command: request.command,
      body: {
        scopes: this.programState.scopes,
      },
    };

    this.sendMessage(response, socket);
  }

  private handleVariables(request: any, socket: Socket) {
    const variablesReference = request.arguments.variablesReference;
    const variables = [];
    
    const data = this.variableHandles.get(variablesReference);
    
    if (data) {
      if (data instanceof Map) {
        // Handle Map (globals)
        for (const [name, value] of data) {
          variables.push({
            name,
            value: JSON.stringify(value),
            type: typeof value,
            variablesReference: 0,
          });
        }
      } else if (Array.isArray(data)) {
        // Handle arrays
        data.forEach((value, index) => {
          variables.push({
            name: index.toString(),
            value: JSON.stringify(value),
            type: typeof value,
            variablesReference: 0,
          });
        });
      } else if (typeof data === "object") {
        // Handle objects
        for (const [key, value] of Object.entries(data)) {
          let varRef = 0;
          
          // Assign variable references for complex types
          if (Array.isArray(value)) {
            varRef = key === "numbers" ? 3 : key === "arr" ? 6 : 0;
          } else if (typeof value === "object" && value !== null) {
            varRef = key === "obj" ? 4 : key === "nested" ? 5 : 0;
          }
          
          variables.push({
            name: key,
            value: typeof value === "object" ? JSON.stringify(value) : String(value),
            type: Array.isArray(value) ? "array" : typeof value,
            variablesReference: varRef,
          });
        }
      }
    }

    const response = {
      seq: this.sequenceNumber++,
      type: "response",
      request_seq: request.seq,
      success: true,
      command: request.command,
      body: {
        variables,
      },
    };

    this.sendMessage(response, socket);
  }

  private handleEvaluate(request: any, socket: Socket) {
    const expression = request.arguments.expression;
    let result = "";
    let variablesReference = 0;
    
    // Simple expression evaluator
    switch (expression) {
      case "1 + 1":
        result = "2";
        break;
      case "numbers":
        result = "[1, 2, 3, 4, 5]";
        variablesReference = 3;
        break;
      case "numbers.length":
        result = "5";
        break;
      case "obj.nested.deep":
        result = '"Deep value"';
        break;
      case "typeof globalVar":
        result = '"string"';
        break;
      default:
        // Try to find in variables
        const locals = this.variableHandles.get(2);
        if (locals && locals[expression]) {
          result = JSON.stringify(locals[expression]);
        } else {
          const response = {
            seq: this.sequenceNumber++,
            type: "response",
            request_seq: request.seq,
            success: false,
            command: request.command,
            message: `Cannot evaluate expression: ${expression}`,
          };
          this.sendMessage(response, socket);
          return;
        }
    }

    const response = {
      seq: this.sequenceNumber++,
      type: "response",
      request_seq: request.seq,
      success: true,
      command: request.command,
      body: {
        result,
        type: "string",
        variablesReference,
      },
    };

    this.sendMessage(response, socket);
  }

  private handleNext(request: any, socket: Socket) {
    const response = {
      seq: this.sequenceNumber++,
      type: "response",
      request_seq: request.seq,
      success: true,
      command: request.command,
    };

    this.sendMessage(response, socket);

    // Simulate step over
    setTimeout(() => {
      this.sendEvent(
        "output",
        {
          category: "console",
          output: "Before calculation\n",
        },
        socket
      );
      
      this.sendEvent(
        "stopped",
        {
          reason: "step",
          description: "Step over",
          threadId: this.programState.threadId,
          allThreadsStopped: true,
        },
        socket
      );
    }, 100);
  }

  private handleStepIn(request: any, socket: Socket) {
    const response = {
      seq: this.sequenceNumber++,
      type: "response",
      request_seq: request.seq,
      success: true,
      command: request.command,
    };

    this.sendMessage(response, socket);

    // Simulate step into calculateSum
    setTimeout(() => {
      this.programState.currentLine = 8;
      
      this.sendEvent(
        "stopped",
        {
          reason: "step",
          description: "Step in",
          threadId: this.programState.threadId,
          allThreadsStopped: true,
        },
        socket
      );
    }, 100);
  }

  private handleStepOut(request: any, socket: Socket) {
    const response = {
      seq: this.sequenceNumber++,
      type: "response",
      request_seq: request.seq,
      success: true,
      command: request.command,
    };

    this.sendMessage(response, socket);

    // Simulate step out
    setTimeout(() => {
      this.programState.currentLine = 25;
      
      this.sendEvent(
        "output",
        {
          category: "console",
          output: "Sum is: 15\n",
        },
        socket
      );
      
      this.sendEvent(
        "stopped",
        {
          reason: "step",
          description: "Step out",
          threadId: this.programState.threadId,
          allThreadsStopped: true,
        },
        socket
      );
    }, 100);
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

    this.sendEvent(
      "continued",
      {
        threadId: request.arguments.threadId,
        allThreadsContinued: true,
      },
      socket
    );

    // Simulate program completion
    setTimeout(() => {
      this.sendEvent(
        "output",
        {
          category: "console",
          output: 'Finished with output: { result: 15, obj: { name: "Test Object", value: 42, nested: { deep: "Deep value" } } }\n',
        },
        socket
      );
      
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

    console.log("Sending:", message.type, message.command || message.event);
    socket.write(response);
  }

  listen(port: number) {
    this.server.listen(port, () => {
      console.log(`Enhanced Mock DAP server listening on port ${port}`);
    });
  }

  close() {
    this.server.close();
  }
}

// Start the server
const server = new EnhancedMockDAPServer();
server.listen(58080);

console.log("Enhanced Mock DAP server started on port 58080");
console.log("Supports: variables, evaluation, and stepping");
console.log("Press Ctrl+C to stop");

process.on("SIGINT", () => {
  console.log("\nShutting down...");
  server.close();
  process.exit(0);
});