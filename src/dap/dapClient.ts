import { EventEmitter } from "events";
import { ChildProcess, spawn } from "child_process";

interface DAPMessage {
  seq: number;
  type: "request" | "response" | "event";
}

interface DAPRequest extends DAPMessage {
  type: "request";
  command: string;
  arguments?: any;
}

interface DAPResponse extends DAPMessage {
  type: "response";
  request_seq: number;
  success: boolean;
  command: string;
  message?: string;
  body?: any;
}

interface DAPEvent extends DAPMessage {
  type: "event";
  event: string;
  body?: any;
}

export class DAPClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private sequenceNumber = 1;
  private pendingRequests = new Map<
    number,
    {
      resolve: (response: any) => void;
      reject: (error: Error) => void;
    }
  >();
  private buffer = "";

  async connect(command: string, args: string[]): Promise<void> {
    console.error(`[DAP] Spawning: ${command} ${args.join(" ")}`);
    this.process = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.setupMessageHandling();
    this.setupErrorHandling();

    // Wait for process to be ready
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  async initialize(args?: any): Promise<any> {
    const defaultArgs = {
      clientID: "dap-test-client",
      clientName: "DAP Test Client",
      adapterID: "node",
      locale: "en",
      linesStartAt1: true,
      columnsStartAt1: true,
      pathFormat: "path",
      supportsVariableType: true,
      supportsVariablePaging: true,
      supportsRunInTerminalRequest: true,
      supportsMemoryReferences: true,
      supportsProgressReporting: true,
      supportsInvalidatedEvent: true,
    };

    return this.sendRequest("initialize", { ...defaultArgs, ...args });
  }

  async sendRequest<T = any>(command: string, args?: any): Promise<T> {
    const seq = this.sequenceNumber++;

    const request: DAPRequest = {
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
    if (!this.process || !this.process.stdin) {
      throw new Error("Not connected");
    }

    const json = JSON.stringify(message);
    const contentLength = Buffer.byteLength(json, "utf8");
    const header = `Content-Length: ${contentLength}\r\n\r\n`;

    console.error(`[DAP] Sending: ${json}`);
    this.process.stdin.write(header + json);
  }

  private setupMessageHandling(): void {
    if (!this.process || !this.process.stdout) return;

    this.process.stdout.on("data", (data: Buffer) => {
      this.buffer += data.toString();

      while (true) {
        const message = this.tryParseMessage();
        if (!message) break;

        console.error(`[DAP] Received: ${JSON.stringify(message)}`);
        this.handleMessage(message);
      }
    });
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

  private handleMessage(message: DAPMessage): void {
    switch (message.type) {
      case "response":
        this.handleResponse(message as DAPResponse);
        break;
      case "event":
        this.handleEvent(message as DAPEvent);
        break;
    }
  }

  private handleResponse(response: DAPResponse): void {
    const pending = this.pendingRequests.get(response.request_seq);
    if (!pending) return;

    this.pendingRequests.delete(response.request_seq);

    if (response.success) {
      pending.resolve(response.body);
    } else {
      pending.reject(new Error(response.message || "Request failed"));
    }
  }

  private handleEvent(event: DAPEvent): void {
    this.emit(event.event, event.body);
    this.emit("event", event);
  }

  private setupErrorHandling(): void {
    if (!this.process) return;

    this.process.on("error", (error) => {
      console.error("[DAP] Process error:", error);
      this.emit("error", error);
    });

    this.process.on("exit", (code, signal) => {
      console.error(`[DAP] Process exited: code=${code}, signal=${signal}`);
      this.emit("exit", { code, signal });
      this.cleanup();
    });

    if (this.process.stderr) {
      this.process.stderr.on("data", (data) => {
        console.error("[DAP] Stderr:", data.toString());
      });
    }
  }

  disconnect(): void {
    if (this.process) {
      this.process.kill();
      this.cleanup();
    }
  }

  private cleanup(): void {
    this.process = null;
    this.pendingRequests.clear();
    this.buffer = "";
    this.removeAllListeners();
  }
}