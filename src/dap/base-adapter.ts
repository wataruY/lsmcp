#!/usr/bin/env node
/**
 * Base DAP Adapter class with common functionality
 */

import { ChildProcess } from "child_process";

export abstract class BaseDAPAdapter {
  protected seq = 1;
  protected child: ChildProcess | null = null;
  protected variables: Record<string, any> = {};
  protected buffer = "";

  constructor() {
    this.setupStdin();
  }

  protected sendMessage(message: any): void {
    const json = JSON.stringify(message);
    const length = Buffer.byteLength(json);
    const header = `Content-Length: ${length}\r\n\r\n`;
    
    this.onSendMessage?.(message);
    process.stdout.write(header + json);
  }

  protected sendResponse(request: any, body: any = {}): void {
    this.sendMessage({
      seq: this.seq++,
      type: "response",
      request_seq: request.seq,
      success: true,
      command: request.command,
      body
    });
  }

  protected sendErrorResponse(request: any, message: string): void {
    this.sendMessage({
      seq: this.seq++,
      type: "response",
      request_seq: request.seq,
      success: false,
      command: request.command,
      message
    });
  }

  protected sendEvent(event: string, body: any = {}): void {
    this.sendMessage({
      seq: this.seq++,
      type: "event",
      event,
      body
    });
  }

  private setupStdin(): void {
    process.stdin.setEncoding("utf8");
    
    process.stdin.on("data", (chunk) => {
      this.buffer += chunk;
      this.processBuffer();
    });
  }

  private processBuffer(): void {
    while (true) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) break;
      
      const header = this.buffer.substring(0, headerEnd);
      const contentLengthMatch = header.match(/Content-Length: (\d+)/);
      
      if (!contentLengthMatch) {
        this.buffer = this.buffer.substring(headerEnd + 4);
        continue;
      }
      
      const contentLength = parseInt(contentLengthMatch[1], 10);
      const bodyStart = headerEnd + 4;
      const bodyEnd = bodyStart + contentLength;
      
      if (this.buffer.length < bodyEnd) break;
      
      const body = this.buffer.substring(bodyStart, bodyEnd);
      this.buffer = this.buffer.substring(bodyEnd);
      
      try {
        const message = JSON.parse(body);
        this.onReceiveMessage?.(message);
        this.handleMessage(message);
      } catch (error) {
        console.error("[DAP] Failed to parse message:", error);
      }
    }
  }

  protected abstract handleMessage(message: any): void;

  // Optional hooks for debugging
  protected onSendMessage?(message: any): void;
  protected onReceiveMessage?(message: any): void;

  // Common handlers
  protected handleInitialize(request: any): void {
    this.sendResponse(request, {
      supportsConfigurationDoneRequest: true,
      supportsFunctionBreakpoints: false,
      supportsConditionalBreakpoints: false,
      supportsEvaluateForHovers: false,
      supportsStepBack: false,
      supportsSetVariable: false,
      supportsStepInTargetsRequest: false,
      supportsCompletionsRequest: false,
      supportsRestartFrame: false,
      supportsExceptionOptions: false,
      supportsValueFormattingOptions: false,
      supportsExceptionInfoRequest: false,
      supportTerminateDebuggee: true,
      supportsDelayedStackTraceLoading: false,
      supportsLoadedSourcesRequest: false,
      supportsLogPoints: false,
      supportsTerminateThreadsRequest: false,
      supportsSetExpression: false,
      supportsTerminateRequest: false,
      supportsDataBreakpoints: false,
      supportsReadMemoryRequest: false,
      supportsDisassembleRequest: false,
      supportsCancelRequest: false
    });
    
    this.sendEvent("initialized");
  }

  protected handleConfigurationDone(request: any): void {
    this.sendResponse(request);
  }

  protected handleDisconnect(request: any): void {
    if (this.child && !this.child.killed) {
      this.child.kill();
    }
    this.sendResponse(request);
    process.exit(0);
  }

  protected cleanup(): void {
    if (this.child && !this.child.killed) {
      this.child.kill();
    }
  }

  public start(): void {
    process.on("SIGTERM", () => this.cleanup());
    process.on("SIGINT", () => this.cleanup());
    
    // Start processing stdin
    process.stdin.resume();
  }
}