import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";

interface LSPMessage {
  jsonrpc: "2.0";
  id?: number | string;
  method?: string;
  params?: any;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface Position {
  line: number;
  character: number;
}

interface Range {
  start: Position;
  end: Position;
}

interface Location {
  uri: string;
  range: Range;
}

interface TextDocumentIdentifier {
  uri: string;
}

interface TextDocumentPositionParams {
  textDocument: TextDocumentIdentifier;
  position: Position;
}

export class LSPClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private messageId = 0;
  private responseHandlers = new Map<number | string, (response: LSPMessage) => void>();
  private buffer = "";
  private contentLength = -1;
  
  constructor(private rootPath: string) {
    super();
  }

  async start(): Promise<void> {
    // Start TypeScript Language Server
    this.process = spawn("npx", ["typescript-language-server", "--stdio"], {
      cwd: this.rootPath,
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.process.stdout?.on("data", (data: Buffer) => {
      this.buffer += data.toString();
      this.processBuffer();
    });

    this.process.stderr?.on("data", (data: Buffer) => {
      console.error("LSP stderr:", data.toString());
    });

    this.process.on("exit", (code) => {
      console.error(`LSP server exited with code ${code}`);
      this.process = null;
    });

    // Initialize the LSP connection
    await this.initialize();
  }

  private processBuffer(): void {
    while (true) {
      if (this.contentLength === -1) {
        // Look for Content-Length header
        const headerEnd = this.buffer.indexOf("\r\n\r\n");
        if (headerEnd === -1) {
          return;
        }

        const header = this.buffer.substring(0, headerEnd);
        const contentLengthMatch = header.match(/Content-Length: (\d+)/);
        if (!contentLengthMatch) {
          console.error("Invalid LSP header:", header);
          this.buffer = this.buffer.substring(headerEnd + 4);
          continue;
        }

        this.contentLength = parseInt(contentLengthMatch[1], 10);
        this.buffer = this.buffer.substring(headerEnd + 4);
      }

      if (this.buffer.length < this.contentLength) {
        // Wait for more data
        return;
      }

      const messageBody = this.buffer.substring(0, this.contentLength);
      this.buffer = this.buffer.substring(this.contentLength);
      this.contentLength = -1;

      try {
        const message = JSON.parse(messageBody) as LSPMessage;
        this.handleMessage(message);
      } catch (e) {
        console.error("Failed to parse LSP message:", messageBody, e);
      }
    }
  }

  private handleMessage(message: LSPMessage): void {
    if (message.id !== undefined && (message.result !== undefined || message.error !== undefined)) {
      // This is a response
      const handler = this.responseHandlers.get(message.id);
      if (handler) {
        handler(message);
        this.responseHandlers.delete(message.id);
      }
    } else if (message.method) {
      // This is a notification or request from server
      this.emit("message", message);
    }
  }

  private sendMessage(message: LSPMessage): void {
    if (!this.process) {
      throw new Error("LSP server not started");
    }

    const content = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n`;
    this.process.stdin?.write(header + content);
  }

  private async sendRequest(method: string, params?: any): Promise<any> {
    const id = ++this.messageId;
    const message: LSPMessage = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.responseHandlers.set(id, (response) => {
        if (response.error) {
          reject(new Error(response.error.message));
        } else {
          resolve(response.result);
        }
      });

      this.sendMessage(message);
    });
  }

  private sendNotification(method: string, params?: any): void {
    const message: LSPMessage = {
      jsonrpc: "2.0",
      method,
      params,
    };
    this.sendMessage(message);
  }

  private async initialize(): Promise<void> {
    const result = await this.sendRequest("initialize", {
      processId: process.pid,
      clientInfo: {
        name: "typescript-mcp-lsp-client",
        version: "0.1.0",
      },
      locale: "en",
      rootPath: this.rootPath,
      rootUri: `file://${this.rootPath}`,
      capabilities: {
        textDocument: {
          definition: {
            linkSupport: true,
          },
          references: {},
          hover: {
            contentFormat: ["markdown", "plaintext"],
          },
        },
      },
    });

    // Send initialized notification
    this.sendNotification("initialized", {});

    return result;
  }

  async openDocument(uri: string, text: string): Promise<void> {
    this.sendNotification("textDocument/didOpen", {
      textDocument: {
        uri,
        languageId: "typescript",
        version: 1,
        text,
      },
    });
  }

  async updateDocument(uri: string, text: string, version: number): Promise<void> {
    this.sendNotification("textDocument/didChange", {
      textDocument: {
        uri,
        version,
      },
      contentChanges: [{ text }],
    });
  }

  async findReferences(uri: string, position: Position): Promise<Location[]> {
    const params: TextDocumentPositionParams = {
      textDocument: { uri },
      position,
    };
    const result = await this.sendRequest("textDocument/references", {
      ...params,
      context: {
        includeDeclaration: true,
      },
    });
    return result || [];
  }

  async getDefinition(uri: string, position: Position): Promise<Location | Location[]> {
    const params: TextDocumentPositionParams = {
      textDocument: { uri },
      position,
    };
    const result = await this.sendRequest("textDocument/definition", params);
    return result || [];
  }

  async getHover(uri: string, position: Position): Promise<any> {
    const params: TextDocumentPositionParams = {
      textDocument: { uri },
      position,
    };
    const result = await this.sendRequest("textDocument/hover", params);
    return result;
  }

  async stop(): Promise<void> {
    if (this.process) {
      // Send shutdown request
      try {
        await this.sendRequest("shutdown");
        this.sendNotification("exit");
      } catch (e) {
        // Ignore errors during shutdown
      }
      
      // Give it a moment to shut down gracefully
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (this.process) {
        this.process.kill();
        this.process = null;
      }
    }
  }
}