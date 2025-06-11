import { ChildProcess } from "child_process";
import { EventEmitter } from "events";
import {
  Position,
  Location,
  Diagnostic,
  Hover,
  Definition,
  DocumentUri,
  integer,
  MarkupContent,
  MarkedString,
} from "vscode-languageserver-types";

// LSP Message types
interface LSPMessage {
  jsonrpc: "2.0";
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// LSP Protocol types
interface TextDocumentIdentifier {
  uri: DocumentUri;
}

interface TextDocumentPositionParams {
  textDocument: TextDocumentIdentifier;
  position: Position;
}

interface PublishDiagnosticsParams {
  uri: DocumentUri;
  diagnostics: Diagnostic[];
}

interface ReferenceContext {
  includeDeclaration: boolean;
}

interface ReferenceParams extends TextDocumentPositionParams {
  context: ReferenceContext;
}

interface ClientCapabilities {
  textDocument?: {
    synchronization?: {
      dynamicRegistration?: boolean;
      willSave?: boolean;
      willSaveWaitUntil?: boolean;
      didSave?: boolean;
    };
    publishDiagnostics?: {
      relatedInformation?: boolean;
    };
    definition?: {
      linkSupport?: boolean;
    };
    references?: Record<string, unknown>;
    hover?: {
      contentFormat?: string[];
    };
  };
}

interface InitializeParams {
  processId: number | null;
  clientInfo?: {
    name: string;
    version?: string;
  };
  locale?: string;
  rootPath?: string | null;
  rootUri: DocumentUri | null;
  capabilities: ClientCapabilities;
}

interface InitializeResult {
  capabilities: {
    textDocumentSync?: number;
    hoverProvider?: boolean;
    definitionProvider?: boolean;
    referencesProvider?: boolean;
    [key: string]: unknown;
  };
  serverInfo?: {
    name: string;
    version?: string;
  };
}

interface TextDocumentItem {
  uri: DocumentUri;
  languageId: string;
  version: integer;
  text: string;
}

interface DidOpenTextDocumentParams {
  textDocument: TextDocumentItem;
}

interface VersionedTextDocumentIdentifier extends TextDocumentIdentifier {
  version: integer;
}

interface TextDocumentContentChangeEvent {
  text: string;
}

interface DidChangeTextDocumentParams {
  textDocument: VersionedTextDocumentIdentifier;
  contentChanges: TextDocumentContentChangeEvent[];
}

// Type aliases
export type HoverResult = Hover | null;
export type DefinitionResult = Definition | Location | Location[] | null;
export type ReferencesResult = Location[] | null;

// Hover contents types
export type HoverContents =
  | string
  | MarkedString
  | MarkupContent
  | (string | MarkedString | MarkupContent)[];

interface LSPClientState {
  process: ChildProcess | null;
  messageId: number;
  responseHandlers: Map<number | string, (response: LSPMessage) => void>;
  buffer: string;
  contentLength: number;
  diagnostics: Map<string, Diagnostic[]>;
  eventEmitter: EventEmitter;
  rootPath: string;
  languageId: string;
}

export interface LSPClientConfig {
  rootPath: string;
  process: ChildProcess;
  languageId?: string; // Default: "typescript"
  clientName?: string; // Default: "lsp-client"
  clientVersion?: string; // Default: "0.1.0"
}

export function createLSPClient(config: LSPClientConfig): LSPClientState & {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  openDocument: (uri: string, text: string) => void;
  updateDocument: (uri: string, text: string, version: number) => void;
  findReferences: (uri: string, position: Position) => Promise<Location[]>;
  getDefinition: (
    uri: string,
    position: Position
  ) => Promise<Location | Location[]>;
  getHover: (uri: string, position: Position) => Promise<HoverResult>;
  getDiagnostics: (uri: string) => Diagnostic[];
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  emit: (event: string, ...args: unknown[]) => boolean;
} {
  const state: LSPClientState = {
    process: config.process,
    messageId: 0,
    responseHandlers: new Map(),
    buffer: "",
    contentLength: -1,
    diagnostics: new Map(),
    eventEmitter: new EventEmitter(),
    rootPath: config.rootPath,
    languageId: config.languageId || "typescript",
  };

  function processBuffer(): void {
    while (state.buffer.length > 0) {
      if (state.contentLength === -1) {
        // Look for Content-Length header
        const headerEnd = state.buffer.indexOf("\r\n\r\n");
        if (headerEnd === -1) {
          return;
        }

        const header = state.buffer.substring(0, headerEnd);
        const contentLengthMatch = header.match(/Content-Length: (\d+)/);
        if (!contentLengthMatch) {
          console.error("Invalid LSP header:", header);
          state.buffer = state.buffer.substring(headerEnd + 4);
          continue;
        }

        state.contentLength = parseInt(contentLengthMatch[1], 10);
        state.buffer = state.buffer.substring(headerEnd + 4);
      }

      if (state.buffer.length < state.contentLength) {
        // Wait for more data
        return;
      }

      const messageBody = state.buffer.substring(0, state.contentLength);
      state.buffer = state.buffer.substring(state.contentLength);
      state.contentLength = -1;

      try {
        const message = JSON.parse(messageBody) as LSPMessage;
        handleMessage(message);
      } catch (error) {
        console.error("Failed to parse LSP message:", messageBody, error);
      }
    }
  }

  function handleMessage(message: LSPMessage): void {
    if (
      message.id !== undefined &&
      (message.result !== undefined || message.error !== undefined)
    ) {
      // This is a response
      const handler = state.responseHandlers.get(message.id);
      if (handler) {
        handler(message);
        state.responseHandlers.delete(message.id);
      }
    } else if (message.method) {
      // This is a notification or request from server
      if (
        message.method === "textDocument/publishDiagnostics" &&
        message.params
      ) {
        // Store diagnostics for the file
        const params = message.params as PublishDiagnosticsParams;
        state.diagnostics.set(params.uri, params.diagnostics);
      }
      state.eventEmitter.emit("message", message);
    }
  }

  function sendMessage(message: LSPMessage): void {
    if (!state.process) {
      throw new Error("LSP server not started");
    }

    const content = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n`;
    state.process.stdin?.write(header + content);
  }

  function sendRequest<T = unknown>(
    method: string,
    params?: unknown
  ): Promise<T> {
    const id = ++state.messageId;
    const message: LSPMessage = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise<T>((resolve, reject) => {
      state.responseHandlers.set(id, (response) => {
        if (response.error) {
          reject(new Error(response.error.message));
        } else {
          resolve(response.result as T);
        }
      });

      sendMessage(message);
    });
  }

  function sendNotification(method: string, params?: unknown): void {
    const message: LSPMessage = {
      jsonrpc: "2.0",
      method,
      params,
    };
    sendMessage(message);
  }

  async function initialize(): Promise<void> {
    const initParams: InitializeParams = {
      processId: process.pid,
      clientInfo: {
        name: config.clientName || "lsp-client",
        version: config.clientVersion || "0.1.0",
      },
      locale: "en",
      rootPath: state.rootPath,
      rootUri: `file://${state.rootPath}`,
      capabilities: {
        textDocument: {
          synchronization: {
            dynamicRegistration: false,
            willSave: false,
            willSaveWaitUntil: false,
            didSave: true,
          },
          publishDiagnostics: {
            relatedInformation: true,
          },
          definition: {
            linkSupport: true,
          },
          references: {},
          hover: {
            contentFormat: ["markdown", "plaintext"],
          },
        },
      },
    };

    await sendRequest<InitializeResult>("initialize", initParams);

    // Send initialized notification
    sendNotification("initialized", {});
  }

  async function start(): Promise<void> {
    if (!state.process) {
      throw new Error("No process provided to LSP client");
    }

    state.process.stdout?.on("data", (data: Buffer) => {
      state.buffer += data.toString();
      processBuffer();
    });

    state.process.stderr?.on("data", (data: Buffer) => {
      console.error("LSP stderr:", data.toString());
    });

    state.process.on("exit", (code) => {
      console.error(`LSP server exited with code ${code}`);
      state.process = null;
    });

    state.process.on("error", (error) => {
      console.error("LSP server error:", error);
    });

    // Initialize the LSP connection
    await initialize();
  }

  function openDocument(uri: string, text: string): void {
    const params: DidOpenTextDocumentParams = {
      textDocument: {
        uri,
        languageId: state.languageId,
        version: 1,
        text,
      },
    };
    sendNotification("textDocument/didOpen", params);
  }

  function updateDocument(uri: string, text: string, version: number): void {
    const params: DidChangeTextDocumentParams = {
      textDocument: {
        uri,
        version,
      },
      contentChanges: [{ text }],
    };
    sendNotification("textDocument/didChange", params);
  }

  async function findReferences(
    uri: string,
    position: Position
  ): Promise<Location[]> {
    const params: ReferenceParams = {
      textDocument: { uri },
      position,
      context: {
        includeDeclaration: true,
      },
    };
    const result = await sendRequest<ReferencesResult>(
      "textDocument/references",
      params
    );
    return result ?? [];
  }

  async function getDefinition(
    uri: string,
    position: Position
  ): Promise<Location | Location[]> {
    const params: TextDocumentPositionParams = {
      textDocument: { uri },
      position,
    };
    const result = await sendRequest<DefinitionResult>(
      "textDocument/definition",
      params
    );

    if (!result) {
      return [];
    }

    if (Array.isArray(result)) {
      return result;
    }

    // Handle single Location or Definition
    if ("uri" in result) {
      return [result];
    }

    // Handle Definition type (convert to Location)
    if ("range" in result && "uri" in result) {
      return [result as Location];
    }

    return [];
  }

  async function getHover(
    uri: string,
    position: Position
  ): Promise<HoverResult> {
    const params: TextDocumentPositionParams = {
      textDocument: { uri },
      position,
    };
    const result = await sendRequest<HoverResult>("textDocument/hover", params);
    return result;
  }

  function getDiagnostics(uri: string): Diagnostic[] {
    // In LSP, diagnostics are pushed by the server via notifications
    // We need to retrieve them from our diagnostics storage
    return state.diagnostics.get(uri) || [];
  }

  async function stop(): Promise<void> {
    if (state.process) {
      // Send shutdown request
      try {
        await sendRequest("shutdown");
        sendNotification("exit");
      } catch {
        // Ignore errors during shutdown
      }

      // Give it a moment to shut down gracefully
      await new Promise((resolve) => setTimeout(resolve, 100));

      try {
        if (!state.process.killed) {
          state.process.kill();
        }
      } catch {
        // Ignore errors during process termination
      }
      state.process = null;
    }
  }

  return {
    ...state,
    start,
    stop,
    openDocument,
    updateDocument,
    findReferences,
    getDefinition,
    getHover,
    getDiagnostics,
    on: (event: string, listener: (...args: unknown[]) => void) =>
      state.eventEmitter.on(event, listener),
    emit: (event: string, ...args: unknown[]) =>
      state.eventEmitter.emit(event, ...args),
  };
}