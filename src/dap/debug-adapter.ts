#!/usr/bin/env node
// @ts-nocheck
/**
 * Debug DAP Adapter with extensive logging
 */

import { spawn, ChildProcess } from "child_process";

console.error("[DEBUG-ADAPTER] Starting...");

let seq = 1;
let child: ChildProcess | null = null;
let variables: Record<string, any> = {};
let isInitialized = false;

function sendMessage(message: any) {
  const json = JSON.stringify(message);
  const length = Buffer.byteLength(json);
  const header = `Content-Length: ${length}\r\n\r\n`;
  
  console.error(`[DEBUG-ADAPTER] Sending: ${json}`);
  process.stdout.write(header + json);
}

function sendResponse(request: any, body: any = {}) {
  sendMessage({
    seq: seq++,
    type: "response",
    request_seq: request.seq,
    success: true,
    command: request.command,
    body
  });
}

function sendEvent(event: string, body: any = {}) {
  sendMessage({
    seq: seq++,
    type: "event",
    event,
    body
  });
}

// Set up stdin handling
process.stdin.setEncoding("utf8");
let buffer = "";

process.stdin.on("data", (chunk) => {
  console.error(`[DEBUG-ADAPTER] Received data chunk: ${chunk.length} bytes`);
  buffer += chunk;
  
  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) break;
    
    const header = buffer.substring(0, headerEnd);
    const match = header.match(/Content-Length: (\d+)/);
    if (!match) break;
    
    const contentLength = parseInt(match[1]);
    const messageStart = headerEnd + 4;
    
    if (buffer.length < messageStart + contentLength) break;
    
    const message = buffer.substring(messageStart, messageStart + contentLength);
    buffer = buffer.substring(messageStart + contentLength);
    
    try {
      const request = JSON.parse(message);
      console.error(`[DEBUG-ADAPTER] Processing request: ${request.command}`);
      handleRequest(request);
    } catch (e) {
      console.error(`[DEBUG-ADAPTER] Error parsing request:`, e);
    }
  }
});

function handleRequest(request: any) {
  console.error(`[DEBUG-ADAPTER] Handling ${request.command}`);
  
  switch (request.command) {
    case "initialize":
      console.error("[DEBUG-ADAPTER] Processing initialize request");
      sendResponse(request, {
        supportsConfigurationDoneRequest: true,
        supportsConditionalBreakpoints: false,
        supportsEvaluateForHovers: true,
        supportsStepBack: false
      });
      
      // Send initialized event
      setTimeout(() => {
        console.error("[DEBUG-ADAPTER] Sending initialized event");
        sendEvent("initialized");
        isInitialized = true;
      }, 10);
      break;
    
    case "launch":
      console.error("[DEBUG-ADAPTER] Processing launch request");
      const { program, args = [] } = request.arguments;
      
      // Launch the program
      child = spawn("node", [program, ...args], {
        stdio: ["pipe", "pipe", "pipe"]
      });
      
      child.stdout?.on("data", (data) => {
        const output = data.toString();
        console.error(`[DEBUG-ADAPTER] Program stdout: ${output.trim()}`);
        
        // Track variables
        const varMatch = output.match(/\[VAR\] (\w+) = (.+)/);
        if (varMatch) {
          const [, name, value] = varMatch;
          try {
            variables[name] = JSON.parse(value);
            console.error(`[DEBUG-ADAPTER] Tracked variable: ${name} = ${value}`);
          } catch {
            variables[name] = value;
          }
        }
        
        sendEvent("output", {
          category: "stdout",
          output
        });
      });
      
      child.stderr?.on("data", (data) => {
        console.error(`[DEBUG-ADAPTER] Program stderr: ${data.toString().trim()}`);
        sendEvent("output", {
          category: "stderr",
          output: data.toString()
        });
      });
      
      child.on("exit", (code) => {
        console.error(`[DEBUG-ADAPTER] Program exited with code ${code}`);
        sendEvent("terminated", { exitCode: code });
      });
      
      sendResponse(request);
      
      if (request.arguments.stopOnEntry) {
        sendEvent("stopped", {
          reason: "entry",
          threadId: 1
        });
      }
      break;
    
    case "setBreakpoints":
      console.error("[DEBUG-ADAPTER] Processing setBreakpoints");
      const breakpoints = request.arguments.breakpoints || [];
      sendResponse(request, {
        breakpoints: breakpoints.map((bp: any, i: number) => ({
          id: i + 1,
          verified: true,
          line: bp.line
        }))
      });
      break;
    
    case "configurationDone":
      console.error("[DEBUG-ADAPTER] Processing configurationDone");
      sendResponse(request);
      break;
    
    case "continue":
      console.error("[DEBUG-ADAPTER] Processing continue");
      sendResponse(request, { allThreadsContinued: true });
      break;
    
    case "threads":
      console.error("[DEBUG-ADAPTER] Processing threads");
      sendResponse(request, {
        threads: [{ id: 1, name: "main" }]
      });
      break;
    
    case "stackTrace":
      console.error("[DEBUG-ADAPTER] Processing stackTrace");
      sendResponse(request, {
        stackFrames: [{
          id: 1,
          name: "main",
          source: { path: "test.js" },
          line: 1,
          column: 1
        }],
        totalFrames: 1
      });
      break;
    
    case "scopes":
      console.error("[DEBUG-ADAPTER] Processing scopes");
      sendResponse(request, {
        scopes: [{
          name: "Local",
          variablesReference: 1,
          expensive: false
        }]
      });
      break;
    
    case "variables":
      console.error("[DEBUG-ADAPTER] Processing variables");
      const vars = Object.entries(variables).map(([name, value], i) => ({
        name,
        value: JSON.stringify(value),
        type: typeof value,
        variablesReference: 0
      }));
      
      sendResponse(request, { variables: vars });
      break;
    
    case "disconnect":
      console.error("[DEBUG-ADAPTER] Processing disconnect");
      if (child) {
        child.kill();
      }
      sendResponse(request);
      setTimeout(() => process.exit(0), 100);
      break;
    
    default:
      console.error(`[DEBUG-ADAPTER] Unknown command: ${request.command}`);
      sendResponse(request);
  }
}

console.error("[DEBUG-ADAPTER] Ready and waiting for commands");

// Handle process termination
process.on("SIGTERM", () => {
  console.error("[DEBUG-ADAPTER] Received SIGTERM");
  if (child) child.kill();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.error("[DEBUG-ADAPTER] Received SIGINT");
  if (child) child.kill();
  process.exit(0);
});