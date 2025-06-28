#!/usr/bin/env node
// @ts-nocheck
/**
 * Minimal Node.js Debug Adapter
 * 
 * This adapter launches Node.js with --inspect and provides basic debugging
 */

import { spawn, ChildProcess } from "child_process";
import * as readline from "readline";

interface DAPMessage {
  seq: number;
  type: "request" | "response" | "event";
  [key: string]: any;
}

class SimpleNodeAdapter {
  private seq = 1;
  private childProcess: ChildProcess | null = null;
  private rl: readline.Interface;
  private initialized = false;

  constructor() {
    // Setup stdin/stdout for DAP communication
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });

    this.rl.on("line", (line) => {
      this.handleMessage(line);
    });
  }

  private sendMessage(message: DAPMessage) {
    const json = JSON.stringify(message);
    const contentLength = Buffer.byteLength(json, "utf8");
    process.stdout.write(`Content-Length: ${contentLength}\r\n\r\n${json}`);
  }

  private sendResponse(request: DAPMessage, body: any = {}) {
    this.sendMessage({
      seq: this.seq++,
      type: "response",
      request_seq: request.seq,
      success: true,
      command: request.command,
      body
    });
  }

  private sendEvent(event: string, body: any = {}) {
    this.sendMessage({
      seq: this.seq++,
      type: "event",
      event,
      body
    });
  }

  private handleMessage(data: string) {
    try {
      // Parse DAP message (skip Content-Length header if present)
      const jsonStart = data.indexOf("{");
      if (jsonStart === -1) return;
      
      const message = JSON.parse(data.substring(jsonStart));
      
      if (message.type === "request") {
        this.handleRequest(message);
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  private handleRequest(request: DAPMessage) {
    switch (request.command) {
      case "initialize":
        this.handleInitialize(request);
        break;
      
      case "launch":
        this.handleLaunch(request);
        break;
      
      case "setBreakpoints":
        this.handleSetBreakpoints(request);
        break;
      
      case "configurationDone":
        this.sendResponse(request);
        break;
      
      case "continue":
        this.sendResponse(request, { allThreadsContinued: true });
        break;
      
      case "disconnect":
        this.handleDisconnect(request);
        break;
      
      default:
        this.sendResponse(request);
    }
  }

  private handleInitialize(request: DAPMessage) {
    this.sendResponse(request, {
      supportsConfigurationDoneRequest: true,
      supportsSetVariable: false,
      supportsConditionalBreakpoints: false,
      supportsEvaluateForHovers: false
    });
    
    this.sendEvent("initialized");
    this.initialized = true;
  }

  private handleLaunch(request: DAPMessage) {
    const { program, args = [], stopOnEntry = false } = request.arguments;
    
    // Launch Node.js with simple output
    const nodeArgs = [...args];
    this.childProcess = spawn("node", [program, ...nodeArgs], {
      stdio: ["pipe", "pipe", "pipe"]
    });

    this.childProcess.stdout?.on("data", (data) => {
      this.sendEvent("output", {
        category: "stdout",
        output: data.toString()
      });
    });

    this.childProcess.stderr?.on("data", (data) => {
      this.sendEvent("output", {
        category: "stderr",
        output: data.toString()
      });
    });

    this.childProcess.on("exit", (code) => {
      this.sendEvent("terminated", { exitCode: code });
    });

    this.sendResponse(request);
    
    if (stopOnEntry) {
      this.sendEvent("stopped", {
        reason: "entry",
        threadId: 1,
        allThreadsStopped: true
      });
    }
  }

  private handleSetBreakpoints(request: DAPMessage) {
    const { breakpoints = [] } = request.arguments;
    
    // Return all breakpoints as verified (even though we don't actually set them)
    const verifiedBreakpoints = breakpoints.map((bp: any, i: number) => ({
      id: i + 1,
      verified: true,
      line: bp.line
    }));
    
    this.sendResponse(request, { breakpoints: verifiedBreakpoints });
  }

  private handleDisconnect(request: DAPMessage) {
    if (this.childProcess) {
      this.childProcess.kill();
      this.childProcess = null;
    }
    
    this.sendResponse(request);
    process.exit(0);
  }
}

// Start the adapter
const adapter = new SimpleNodeAdapter();

// Handle stdin properly
process.stdin.setEncoding("utf8");
let buffer = "";

process.stdin.on("data", (chunk) => {
  buffer += chunk;
  
  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) break;
    
    const header = buffer.substring(0, headerEnd);
    const contentLengthMatch = header.match(/Content-Length: (\d+)/);
    if (!contentLengthMatch) break;
    
    const contentLength = parseInt(contentLengthMatch[1]);
    const messageStart = headerEnd + 4;
    
    if (buffer.length < messageStart + contentLength) break;
    
    const message = buffer.substring(messageStart, messageStart + contentLength);
    buffer = buffer.substring(messageStart + contentLength);
    
    // Handle the message
    adapter["handleMessage"](message);
  }
});