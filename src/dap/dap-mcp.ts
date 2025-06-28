#!/usr/bin/env node
/**
 * DAP MCP Server - Debug Adapter Protocol tools for MCP with enhanced features
 */

import { z } from "zod";
import { BaseMcpServer, ToolDef } from "../mcp/_mcplib.ts";
import { createDebugSession, DebugSession } from "./index.ts";
import type { StoppedEvent, Variable, StackFrame, Scope } from "./types.ts";
import * as fs from "fs/promises";
import * as path from "path";
import { existsSync } from "fs";

// Session states
enum SessionState {
  CONNECTING = "connecting",
  CONNECTED = "connected",
  STOPPED = "stopped",
  RUNNING = "running",
  TERMINATED = "terminated",
  ERROR = "error"
}

// Breakpoint information
interface BreakpointInfo {
  id: number;
  source: string;
  line: number;
  condition?: string;
  hitCount: number;
  verified: boolean;
  createdAt: Date;
}

// Debug event for logging
interface DebugEvent {
  timestamp: Date;
  sessionId: string;
  type: string;
  data: any;
}

// Session information
interface SessionInfo {
  session: DebugSession;
  state: SessionState;
  createdAt: Date;
  lastActivityAt: Date;
  program?: string;
  adapter: string;
  breakpoints: Map<string, BreakpointInfo[]>;
  events: DebugEvent[];
  logFile?: string;
}

// Active debug sessions
const sessions = new Map<string, SessionInfo>();

// Value tracking
const valueHistory = new Map<string, Array<{ timestamp: Date; value: any; label?: string }>>();
const timeCheckpoints = new Map<string, Date>();

// Global breakpoint counter
let breakpointIdCounter = 0;

// Debug logs directory
const DEBUG_LOGS_DIR = process.env.DAP_DEBUG_LOGS_DIR || path.join(process.cwd(), ".dap-debug-logs");

// Helper function to ensure logs directory exists
async function ensureLogsDirectory(): Promise<void> {
  if (!existsSync(DEBUG_LOGS_DIR)) {
    await fs.mkdir(DEBUG_LOGS_DIR, { recursive: true });
  }
}

// Helper function to log debug event
async function logDebugEvent(sessionId: string, type: string, data: any): Promise<void> {
  const sessionInfo = sessions.get(sessionId);
  if (!sessionInfo) return;

  const event: DebugEvent = {
    timestamp: new Date(),
    sessionId,
    type,
    data
  };

  sessionInfo.events.push(event);

  // Write to log file if enabled
  if (sessionInfo.logFile) {
    try {
      const logEntry = JSON.stringify(event) + "\n";
      await fs.appendFile(sessionInfo.logFile, logEntry);
    } catch (error) {
      console.error(`Failed to write to log file: ${error}`);
    }
  }
}

// Helper function to validate session
function validateSession(sessionId: string, requiredStates?: SessionState[]): SessionInfo {
  const sessionInfo = sessions.get(sessionId);
  if (!sessionInfo) {
    throw new Error(`Session ${sessionId} not found. Use debug_launch or debug_attach to create a session first.`);
  }

  if (requiredStates && !requiredStates.includes(sessionInfo.state)) {
    throw new Error(
      `Session ${sessionId} is in state '${sessionInfo.state}', but operation requires one of: ${requiredStates.join(", ")}`
    );
  }

  // Update last activity
  sessionInfo.lastActivityAt = new Date();
  return sessionInfo;
}

// Helper function to format variable
function formatVariable(variable: Variable, indent: string): string {
  let result = `${indent}${variable.name}: ${variable.value}`;
  if (variable.type) {
    result += ` (${variable.type})`;
  }
  return result;
}

// Tool definitions
const launchDebugSessionTool: ToolDef<z.ZodType> = {
  name: "debug_launch",
  description: "Launch a new debug session for a program",
  schema: z.object({
    sessionId: z.string().describe("Unique identifier for this debug session"),
    adapter: z.string().describe("Debug adapter to use (e.g., 'node', 'python')"),
    adapterArgs: z.array(z.string()).optional().describe("Arguments for the debug adapter"),
    program: z.string().describe("Path to the program to debug"),
    args: z.array(z.string()).optional().describe("Program arguments"),
    env: z.record(z.string()).optional().describe("Environment variables"),
    cwd: z.string().optional().describe("Working directory"),
    stopOnEntry: z.boolean().optional().describe("Stop at program entry point"),
    enableLogging: z.boolean().optional().describe("Enable debug event logging to file"),
  }),
  execute: async (args) => {
    if (sessions.has(args.sessionId)) {
      const existing = sessions.get(args.sessionId)!;
      if (existing.state !== SessionState.TERMINATED && existing.state !== SessionState.ERROR) {
        throw new Error(`Session ${args.sessionId} already exists and is ${existing.state}`);
      }
      // Clean up terminated/error session
      sessions.delete(args.sessionId);
    }

    const session = createDebugSession({
      adapter: args.adapter,
      adapterArgs: args.adapterArgs,
      clientID: `mcp-dap-${args.sessionId}`,
      clientName: "MCP DAP Server",
    });

    // Create log file if logging is enabled
    let logFile: string | undefined;
    if (args.enableLogging) {
      await ensureLogsDirectory();
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      logFile = path.join(DEBUG_LOGS_DIR, `debug-${args.sessionId}-${timestamp}.jsonl`);
    }

    const sessionInfo: SessionInfo = {
      session,
      state: SessionState.CONNECTING,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      program: args.program,
      adapter: args.adapter,
      breakpoints: new Map(),
      events: [],
      logFile,
    };

    sessions.set(args.sessionId, sessionInfo);

    // Set up event handlers
    session.on("stopped", async (event: StoppedEvent) => {
      sessionInfo.state = SessionState.STOPPED;
      sessionInfo.lastActivityAt = new Date();
      await logDebugEvent(args.sessionId, "stopped", event);

      // Update breakpoint hit counts
      if (event.reason === "breakpoint" && event.hitBreakpointIds) {
        for (const bpId of event.hitBreakpointIds) {
          for (const [_, bps] of sessionInfo.breakpoints) {
            const bp = bps.find(b => b.id === bpId);
            if (bp) {
              bp.hitCount++;
              await logDebugEvent(args.sessionId, "breakpoint_hit", {
                breakpointId: bp.id,
                source: bp.source,
                line: bp.line,
                hitCount: bp.hitCount
              });
            }
          }
        }
      }
    });

    session.on("continued", async () => {
      sessionInfo.state = SessionState.RUNNING;
      sessionInfo.lastActivityAt = new Date();
      await logDebugEvent(args.sessionId, "continued", {});
    });

    session.on("terminated", async () => {
      sessionInfo.state = SessionState.TERMINATED;
      sessionInfo.lastActivityAt = new Date();
      await logDebugEvent(args.sessionId, "terminated", {});
    });

    session.on("output", async (event) => {
      sessionInfo.lastActivityAt = new Date();
      await logDebugEvent(args.sessionId, "output", event);
    });

    try {
      await session.connect();
      sessionInfo.state = SessionState.CONNECTED;
      await logDebugEvent(args.sessionId, "connected", { adapter: args.adapter });
      
      await session.launch(args.program, {
        args: args.args,
        env: args.env,
        cwd: args.cwd,
        stopOnEntry: args.stopOnEntry,
        noDebug: false,
      });

      if (!args.stopOnEntry) {
        sessionInfo.state = SessionState.RUNNING;
      }

      await logDebugEvent(args.sessionId, "launched", { 
        program: args.program,
        args: args.args,
        cwd: args.cwd
      });

      const result = [`Debug session ${args.sessionId} launched for ${args.program} (state: ${sessionInfo.state})`];
      if (logFile) {
        result.push(`Logging to: ${logFile}`);
      }
      return result.join("\n");
    } catch (error) {
      sessionInfo.state = SessionState.ERROR;
      await logDebugEvent(args.sessionId, "error", { error: String(error) });
      sessions.delete(args.sessionId);
      throw error;
    }
  },
};

const attachDebugSessionTool: ToolDef<z.ZodType> = {
  name: "debug_attach",
  description: "Attach to a running process for debugging",
  schema: z.object({
    sessionId: z.string().describe("Unique identifier for this debug session"),
    adapter: z.string().describe("Debug adapter to use"),
    adapterArgs: z.array(z.string()).optional().describe("Arguments for the debug adapter"),
    processId: z.number().optional().describe("Process ID to attach to"),
    port: z.number().optional().describe("Debug port to connect to"),
    host: z.string().optional().describe("Debug host to connect to"),
    enableLogging: z.boolean().optional().describe("Enable debug event logging to file"),
  }),
  execute: async (args) => {
    if (sessions.has(args.sessionId)) {
      const existing = sessions.get(args.sessionId)!;
      if (existing.state !== SessionState.TERMINATED && existing.state !== SessionState.ERROR) {
        throw new Error(`Session ${args.sessionId} already exists and is ${existing.state}`);
      }
      sessions.delete(args.sessionId);
    }

    const session = createDebugSession({
      adapter: args.adapter,
      adapterArgs: args.adapterArgs,
      clientID: `mcp-dap-${args.sessionId}`,
      clientName: "MCP DAP Server",
    });

    // Create log file if logging is enabled
    let logFile: string | undefined;
    if (args.enableLogging) {
      await ensureLogsDirectory();
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      logFile = path.join(DEBUG_LOGS_DIR, `debug-${args.sessionId}-${timestamp}.jsonl`);
    }

    const sessionInfo: SessionInfo = {
      session,
      state: SessionState.CONNECTING,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      adapter: args.adapter,
      breakpoints: new Map(),
      events: [],
      logFile,
    };

    sessions.set(args.sessionId, sessionInfo);

    try {
      await session.connect();
      sessionInfo.state = SessionState.CONNECTED;
      await logDebugEvent(args.sessionId, "connected", { adapter: args.adapter });
      
      await session.attach({
        processId: args.processId,
        port: args.port,
        host: args.host,
      });

      sessionInfo.state = SessionState.RUNNING;
      await logDebugEvent(args.sessionId, "attached", {
        processId: args.processId,
        port: args.port,
        host: args.host
      });

      const result = [`Debug session ${args.sessionId} attached (state: ${sessionInfo.state})`];
      if (logFile) {
        result.push(`Logging to: ${logFile}`);
      }
      return result.join("\n");
    } catch (error) {
      sessionInfo.state = SessionState.ERROR;
      await logDebugEvent(args.sessionId, "error", { error: String(error) });
      sessions.delete(args.sessionId);
      throw error;
    }
  },
};

const setBreakpointsTool: ToolDef<z.ZodType> = {
  name: "debug_set_breakpoints",
  description: "Set breakpoints in a source file",
  schema: z.object({
    sessionId: z.string().describe("Debug session ID"),
    source: z.string().describe("Source file path"),
    lines: z.array(z.number()).describe("Line numbers for breakpoints"),
    conditions: z.array(z.string()).optional().describe("Conditional expressions for breakpoints"),
  }),
  execute: async (args) => {
    const sessionInfo = validateSession(args.sessionId, [
      SessionState.CONNECTED,
      SessionState.STOPPED,
      SessionState.RUNNING,
    ]);

    // Clear existing breakpoints for this source
    sessionInfo.breakpoints.delete(args.source);

    // Create new breakpoint entries
    const breakpoints: BreakpointInfo[] = args.lines.map((line: number, index: number) => ({
      id: ++breakpointIdCounter,
      source: args.source,
      line,
      condition: args.conditions?.[index],
      hitCount: 0,
      verified: false,
      createdAt: new Date(),
    }));

    sessionInfo.breakpoints.set(args.source, breakpoints);

    await sessionInfo.session.setBreakpoints(args.source, args.lines, args.conditions);
    
    await logDebugEvent(args.sessionId, "breakpoints_set", {
      source: args.source,
      breakpoints: breakpoints.map(bp => ({
        id: bp.id,
        line: bp.line,
        condition: bp.condition
      }))
    });

    return `Set ${args.lines.length} breakpoints in ${args.source}`;
  },
};

const listBreakpointsTool: ToolDef<z.ZodType> = {
  name: "debug_list_breakpoints",
  description: "List all breakpoints in the debug session",
  schema: z.object({
    sessionId: z.string().describe("Debug session ID"),
    source: z.string().optional().describe("Filter by source file"),
  }),
  execute: async (args) => {
    const sessionInfo = validateSession(args.sessionId);

    const result: string[] = [];
    let totalBreakpoints = 0;

    for (const [source, breakpoints] of sessionInfo.breakpoints) {
      if (args.source && source !== args.source) continue;

      result.push(`\n${source}:`);
      for (const bp of breakpoints) {
        const condition = bp.condition ? ` [condition: ${bp.condition}]` : "";
        const hits = bp.hitCount > 0 ? ` (hit ${bp.hitCount} times)` : "";
        result.push(`  Line ${bp.line}: ID=${bp.id}${condition}${hits}`);
        totalBreakpoints++;
      }
    }

    if (totalBreakpoints === 0) {
      return args.source 
        ? `No breakpoints in ${args.source}`
        : "No breakpoints set";
    }

    return `Total breakpoints: ${totalBreakpoints}${result.join("\n")}`;
  },
};

const clearBreakpointsTool: ToolDef<z.ZodType> = {
  name: "debug_clear_breakpoints",
  description: "Clear breakpoints in a source file or all breakpoints",
  schema: z.object({
    sessionId: z.string().describe("Debug session ID"),
    source: z.string().optional().describe("Source file to clear breakpoints from (clears all if not specified)"),
  }),
  execute: async (args) => {
    const sessionInfo = validateSession(args.sessionId, [
      SessionState.CONNECTED,
      SessionState.STOPPED,
      SessionState.RUNNING,
    ]);

    if (args.source) {
      const breakpoints = sessionInfo.breakpoints.get(args.source);
      if (breakpoints) {
        sessionInfo.breakpoints.delete(args.source);
        await sessionInfo.session.setBreakpoints(args.source, []);
        
        await logDebugEvent(args.sessionId, "breakpoints_cleared", {
          source: args.source,
          count: breakpoints.length
        });

        return `Cleared ${breakpoints.length} breakpoints from ${args.source}`;
      }
      return `No breakpoints to clear in ${args.source}`;
    } else {
      // Clear all breakpoints
      let totalCleared = 0;
      for (const [source, breakpoints] of sessionInfo.breakpoints) {
        totalCleared += breakpoints.length;
        await sessionInfo.session.setBreakpoints(source, []);
      }
      sessionInfo.breakpoints.clear();

      await logDebugEvent(args.sessionId, "all_breakpoints_cleared", {
        count: totalCleared
      });

      return `Cleared all ${totalCleared} breakpoints`;
    }
  },
};

const getBreakpointStatsTool: ToolDef<z.ZodType> = {
  name: "debug_get_breakpoint_stats",
  description: "Get statistics about breakpoint hits",
  schema: z.object({
    sessionId: z.string().describe("Debug session ID"),
  }),
  execute: async (args) => {
    const sessionInfo = validateSession(args.sessionId);

    const stats: Array<{source: string; line: number; hits: number; condition?: string}> = [];
    let totalHits = 0;

    for (const [source, breakpoints] of sessionInfo.breakpoints) {
      for (const bp of breakpoints) {
        if (bp.hitCount > 0) {
          stats.push({
            source,
            line: bp.line,
            hits: bp.hitCount,
            condition: bp.condition
          });
          totalHits += bp.hitCount;
        }
      }
    }

    if (stats.length === 0) {
      return "No breakpoints have been hit yet";
    }

    // Sort by hit count descending
    stats.sort((a, b) => b.hits - a.hits);

    const result = [`Breakpoint Hit Statistics (Total hits: ${totalHits}):`];
    for (const stat of stats) {
      const condition = stat.condition ? ` [${stat.condition}]` : "";
      result.push(`  ${stat.source}:${stat.line}${condition} - ${stat.hits} hits`);
    }

    return result.join("\n");
  },
};

const getDebugLogTool: ToolDef<z.ZodType> = {
  name: "debug_get_log",
  description: "Get debug event log for the session",
  schema: z.object({
    sessionId: z.string().describe("Debug session ID"),
    eventType: z.string().optional().describe("Filter by event type"),
    limit: z.number().optional().describe("Maximum number of events to return (default: 50)"),
  }),
  execute: async (args) => {
    const sessionInfo = validateSession(args.sessionId);

    let events = sessionInfo.events;
    
    // Filter by event type if specified
    if (args.eventType) {
      events = events.filter(e => e.type === args.eventType);
    }

    // Apply limit
    const limit = args.limit || 50;
    if (events.length > limit) {
      events = events.slice(-limit);
    }

    if (events.length === 0) {
      return args.eventType 
        ? `No events of type '${args.eventType}' found`
        : "No debug events recorded";
    }

    const result = [`Debug Event Log (${events.length} events):`];
    if (sessionInfo.logFile) {
      result.push(`Log file: ${sessionInfo.logFile}`);
    }
    result.push("");

    for (const event of events) {
      const time = event.timestamp.toLocaleTimeString();
      const data = JSON.stringify(event.data, null, 2).replace(/\n/g, "\n  ");
      result.push(`[${time}] ${event.type}:\n  ${data}`);
    }

    return result.join("\n");
  },
};

const exportDebugLogTool: ToolDef<z.ZodType> = {
  name: "debug_export_log",
  description: "Export debug session log to a file",
  schema: z.object({
    sessionId: z.string().describe("Debug session ID"),
    format: z.enum(["json", "jsonl", "text"]).optional().describe("Export format (default: jsonl)"),
  }),
  execute: async (args) => {
    const sessionInfo = validateSession(args.sessionId);

    if (sessionInfo.events.length === 0) {
      return "No debug events to export";
    }

    await ensureLogsDirectory();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const format = args.format || "jsonl";
    const filename = `export-${args.sessionId}-${timestamp}.${format === "text" ? "txt" : format}`;
    const filepath = path.join(DEBUG_LOGS_DIR, filename);

    let content: string;
    
    switch (format) {
      case "json":
        content = JSON.stringify(sessionInfo.events, null, 2);
        break;
      
      case "jsonl":
        content = sessionInfo.events.map(e => JSON.stringify(e)).join("\n");
        break;
      
      case "text":
        content = sessionInfo.events.map(e => {
          const time = e.timestamp.toISOString();
          const data = JSON.stringify(e.data, null, 2);
          return `[${time}] ${e.type}:\n${data}\n`;
        }).join("\n---\n\n");
        break;
      
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    await fs.writeFile(filepath, content);

    return `Exported ${sessionInfo.events.length} events to: ${filepath}`;
  },
};

const getSessionInfoTool: ToolDef<z.ZodType> = {
  name: "debug_get_session_info",
  description: "Get detailed information about a debug session",
  schema: z.object({
    sessionId: z.string().describe("Debug session ID"),
  }),
  execute: async (args) => {
    const sessionInfo = sessions.get(args.sessionId);
    if (!sessionInfo) {
      return `Session ${args.sessionId} not found`;
    }

    const age = Date.now() - sessionInfo.createdAt.getTime();
    const idle = Date.now() - sessionInfo.lastActivityAt.getTime();
    const totalBreakpoints = Array.from(sessionInfo.breakpoints.values()).reduce((sum, bps) => sum + bps.length, 0);

    return [
      `Session ID: ${args.sessionId}`,
      `State: ${sessionInfo.state}`,
      `Adapter: ${sessionInfo.adapter}`,
      `Program: ${sessionInfo.program || "N/A"}`,
      `Breakpoints: ${totalBreakpoints}`,
      `Events logged: ${sessionInfo.events.length}`,
      `Created: ${sessionInfo.createdAt.toLocaleString()} (${Math.floor(age / 1000)}s ago)`,
      `Last Activity: ${sessionInfo.lastActivityAt.toLocaleString()} (${Math.floor(idle / 1000)}s ago)`,
      sessionInfo.logFile ? `Log file: ${sessionInfo.logFile}` : "Logging: disabled"
    ].join("\n");
  },
};

const cleanupSessionsTool: ToolDef<z.ZodType> = {
  name: "debug_cleanup_sessions",
  description: "Clean up terminated or stale debug sessions",
  schema: z.object({
    maxIdleMinutes: z.number().optional().describe("Maximum idle time in minutes before cleaning up (default: 30)"),
  }),
  execute: async (args) => {
    const maxIdle = (args.maxIdleMinutes || 30) * 60 * 1000;
    const now = Date.now();
    const cleaned: string[] = [];

    for (const [sessionId, sessionInfo] of sessions) {
      const idle = now - sessionInfo.lastActivityAt.getTime();
      
      if (sessionInfo.state === SessionState.TERMINATED || 
          sessionInfo.state === SessionState.ERROR ||
          idle > maxIdle) {
        try {
          if (sessionInfo.state !== SessionState.TERMINATED) {
            await sessionInfo.session.disconnect(true);
          }
        } catch (error) {
          // Ignore errors during cleanup
        }
        sessions.delete(sessionId);
        cleaned.push(`${sessionId} (${sessionInfo.state}, idle: ${Math.floor(idle / 1000)}s)`);
      }
    }

    if (cleaned.length === 0) {
      return "No sessions to clean up";
    }

    return `Cleaned up ${cleaned.length} sessions:\n${cleaned.map(s => `- ${s}`).join("\n")}`;
  },
};

const continueTool: ToolDef<z.ZodType> = {
  name: "debug_continue",
  description: "Continue execution in debug session",
  schema: z.object({
    sessionId: z.string().describe("Debug session ID"),
    threadId: z.number().optional().describe("Thread ID to continue (defaults to current)"),
  }),
  execute: async (args) => {
    const sessionInfo = validateSession(args.sessionId, [SessionState.STOPPED]);

    await sessionInfo.session.continue(args.threadId);
    sessionInfo.state = SessionState.RUNNING;
    await logDebugEvent(args.sessionId, "continue", { threadId: args.threadId });
    
    return "Execution continued";
  },
};

const stepOverTool: ToolDef<z.ZodType> = {
  name: "debug_step_over",
  description: "Step over to the next line",
  schema: z.object({
    sessionId: z.string().describe("Debug session ID"),
    threadId: z.number().optional().describe("Thread ID to step (defaults to current)"),
  }),
  execute: async (args) => {
    const sessionInfo = validateSession(args.sessionId, [SessionState.STOPPED]);

    await sessionInfo.session.stepOver(args.threadId);
    await logDebugEvent(args.sessionId, "step_over", { threadId: args.threadId });
    return "Stepped to next line";
  },
};

const stepIntoTool: ToolDef<z.ZodType> = {
  name: "debug_step_into",
  description: "Step into function call",
  schema: z.object({
    sessionId: z.string().describe("Debug session ID"),
    threadId: z.number().optional().describe("Thread ID to step (defaults to current)"),
  }),
  execute: async (args) => {
    const sessionInfo = validateSession(args.sessionId, [SessionState.STOPPED]);

    await sessionInfo.session.stepIn(args.threadId);
    await logDebugEvent(args.sessionId, "step_into", { threadId: args.threadId });
    return "Stepped into function";
  },
};

const stepOutTool: ToolDef<z.ZodType> = {
  name: "debug_step_out",
  description: "Step out of current function",
  schema: z.object({
    sessionId: z.string().describe("Debug session ID"),
    threadId: z.number().optional().describe("Thread ID to step (defaults to current)"),
  }),
  execute: async (args) => {
    const sessionInfo = validateSession(args.sessionId, [SessionState.STOPPED]);

    await sessionInfo.session.stepOut(args.threadId);
    await logDebugEvent(args.sessionId, "step_out", { threadId: args.threadId });
    return "Stepped out of function";
  },
};

const pauseTool: ToolDef<z.ZodType> = {
  name: "debug_pause",
  description: "Pause execution in debug session",
  schema: z.object({
    sessionId: z.string().describe("Debug session ID"),
    threadId: z.number().optional().describe("Thread ID to pause (defaults to current)"),
  }),
  execute: async (args) => {
    const sessionInfo = validateSession(args.sessionId, [SessionState.RUNNING]);

    await sessionInfo.session.pause(args.threadId);
    sessionInfo.state = SessionState.STOPPED;
    await logDebugEvent(args.sessionId, "pause", { threadId: args.threadId });
    
    return "Execution paused";
  },
};

const getStackTraceTool: ToolDef<z.ZodType> = {
  name: "debug_get_stack_trace",
  description: "Get the current stack trace",
  schema: z.object({
    sessionId: z.string().describe("Debug session ID"),
    threadId: z.number().optional().describe("Thread ID (defaults to current)"),
  }),
  execute: async (args) => {
    const sessionInfo = validateSession(args.sessionId, [SessionState.STOPPED]);

    const stackFrames = await sessionInfo.session.getStackTrace(args.threadId);
    await logDebugEvent(args.sessionId, "stack_trace", { 
      threadId: args.threadId,
      frames: stackFrames.length 
    });
    
    return stackFrames.map((frame: StackFrame, index: number) => 
      `#${index} ${frame.name} at ${frame.source?.path || 'unknown'}:${frame.line}:${frame.column}`
    ).join("\n");
  },
};

const getVariablesTool: ToolDef<z.ZodType> = {
  name: "debug_get_variables",
  description: "Get variables in the current scope",
  schema: z.object({
    sessionId: z.string().describe("Debug session ID"),
    frameId: z.number().optional().describe("Stack frame ID (defaults to current)"),
    scopeName: z.string().optional().describe("Scope name (e.g., 'Locals', 'Globals')"),
  }),
  execute: async (args) => {
    const sessionInfo = validateSession(args.sessionId, [SessionState.STOPPED]);

    const scopes = await sessionInfo.session.getScopes(args.frameId);
    
    let targetScopes: Scope[] = scopes;
    if (args.scopeName) {
      targetScopes = scopes.filter(s => s.name === args.scopeName);
      if (targetScopes.length === 0) {
        return `Scope '${args.scopeName}' not found. Available scopes: ${scopes.map(s => s.name).join(", ")}`;
      }
    }

    const result: string[] = [];
    
    for (const scope of targetScopes) {
      result.push(`\n${scope.name}:`);
      const variables = await sessionInfo.session.getVariables(scope.variablesReference);
      
      for (const variable of variables) {
        result.push(formatVariable(variable, "  "));
        
        // Get nested variables if they exist
        if (variable.variablesReference > 0) {
          const nested = await sessionInfo.session.getVariables(variable.variablesReference);
          for (const nestedVar of nested.slice(0, 5)) { // Limit nested display
            result.push(formatVariable(nestedVar, "    "));
          }
          if (nested.length > 5) {
            result.push(`    ... and ${nested.length - 5} more`);
          }
        }
      }
    }

    await logDebugEvent(args.sessionId, "variables_inspected", {
      frameId: args.frameId,
      scopeName: args.scopeName,
      scopeCount: targetScopes.length
    });

    return result.join("\n");
  },
};

const evaluateExpressionTool: ToolDef<z.ZodType> = {
  name: "debug_evaluate",
  description: "Evaluate an expression in the current debug context",
  schema: z.object({
    sessionId: z.string().describe("Debug session ID"),
    expression: z.string().describe("Expression to evaluate"),
    frameId: z.number().optional().describe("Stack frame ID (defaults to current)"),
    context: z.enum(["watch", "repl", "hover"]).optional().describe("Evaluation context"),
  }),
  execute: async (args) => {
    const sessionInfo = validateSession(args.sessionId, [SessionState.STOPPED]);

    try {
      const result = await sessionInfo.session.evaluate(
        args.expression, 
        args.frameId,
        args.context || "repl"
      );
      
      await logDebugEvent(args.sessionId, "evaluate", {
        expression: args.expression,
        result,
        context: args.context || "repl"
      });

      return `${args.expression} = ${result}`;
    } catch (error) {
      await logDebugEvent(args.sessionId, "evaluate_error", {
        expression: args.expression,
        error: String(error)
      });
      return `Error evaluating expression: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};

const listDebugSessionsTool: ToolDef<z.ZodType> = {
  name: "debug_list_sessions",
  description: "List all active debug sessions",
  schema: z.object({}),
  execute: async () => {
    if (sessions.size === 0) {
      return "No active debug sessions";
    }

    const sessionList = Array.from(sessions.entries())
      .map(([id, info]) => {
        const idle = Math.floor((Date.now() - info.lastActivityAt.getTime()) / 1000);
        const breakpoints = Array.from(info.breakpoints.values()).reduce((sum, bps) => sum + bps.length, 0);
        return `- ${id} (${info.state}, adapter: ${info.adapter}, breakpoints: ${breakpoints}, idle: ${idle}s)`;
      })
      .join("\n");
    
    return `Active debug sessions:\n${sessionList}`;
  },
};

const disconnectDebugSessionTool: ToolDef<z.ZodType> = {
  name: "debug_disconnect",
  description: "Disconnect and end a debug session",
  schema: z.object({
    sessionId: z.string().describe("Debug session ID"),
    terminateDebuggee: z.boolean().optional().describe("Terminate the debugged program"),
  }),
  execute: async (args) => {
    const sessionInfo = validateSession(args.sessionId);

    try {
      await sessionInfo.session.disconnect(args.terminateDebuggee ?? true);
      sessionInfo.state = SessionState.TERMINATED;
      await logDebugEvent(args.sessionId, "disconnected", {
        terminateDebuggee: args.terminateDebuggee ?? true
      });
    } catch (error) {
      // Ignore errors during disconnect
    }
    
    sessions.delete(args.sessionId);
    
    return `Debug session ${args.sessionId} disconnected`;
  },
};

// Value tracking tools
const trackValueTool: ToolDef<z.ZodType> = {
  name: "debug_track_value",
  description: "Track and log value changes during debugging",
  schema: z.object({
    sessionId: z.string().describe("Debug session ID"),
    name: z.string().describe("Variable name to track"),
    value: z.any().optional().describe("Current value (will be evaluated if not provided)"),
    label: z.string().optional().describe("Optional label for this tracking point"),
  }),
  execute: async (args) => {
    const sessionInfo = validateSession(args.sessionId, [SessionState.STOPPED]);

    let value = args.value;
    
    // If value not provided, try to evaluate the variable
    if (value === undefined) {
      try {
        value = await sessionInfo.session.evaluate(args.name);
      } catch (error) {
        return `Error evaluating ${args.name}: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    const history = valueHistory.get(args.name) || [];
    history.push({
      timestamp: new Date(),
      value,
      label: args.label,
    });
    valueHistory.set(args.name, history);

    await logDebugEvent(args.sessionId, "value_tracked", {
      name: args.name,
      value,
      label: args.label
    });

    const prefix = args.label ? `[${args.label}] ` : "";
    return `${prefix}${args.name} = ${JSON.stringify(value)}`;
  },
};

const getValueHistoryTool: ToolDef<z.ZodType> = {
  name: "debug_get_value_history",
  description: "Get the history of tracked values",
  schema: z.object({
    name: z.string().describe("Variable name to get history for"),
  }),
  execute: async (args) => {
    const history = valueHistory.get(args.name);
    if (!history || history.length === 0) {
      return `No history for ${args.name}`;
    }

    const entries = history.map((entry, index) => {
      const time = entry.timestamp.toLocaleTimeString();
      const label = entry.label ? ` [${entry.label}]` : "";
      return `${index + 1}. ${time}${label}: ${JSON.stringify(entry.value)}`;
    });

    return `History for ${args.name}:\n${entries.join("\n")}`;
  },
};

const clearValueHistoryTool: ToolDef<z.ZodType> = {
  name: "debug_clear_value_history",
  description: "Clear all tracked value history",
  schema: z.object({}),
  execute: async () => {
    const count = valueHistory.size;
    valueHistory.clear();
    timeCheckpoints.clear();
    return `Cleared ${count} tracked values`;
  },
};

// Create and configure the MCP server
class DAPMcpServer extends BaseMcpServer {
  constructor() {
    super({
      name: "dap-mcp",
      version: "2.0.0",
      description: "Debug Adapter Protocol MCP server with enhanced features"
    });
    this.setupHandlers();
  }

  protected setupHandlers(): void {
    // Core debugging tools
    this.registerTool(launchDebugSessionTool);
    this.registerTool(attachDebugSessionTool);
    this.registerTool(setBreakpointsTool);
    this.registerTool(continueTool);
    this.registerTool(stepOverTool);
    this.registerTool(stepIntoTool);
    this.registerTool(stepOutTool);
    this.registerTool(pauseTool);
    this.registerTool(getStackTraceTool);
    this.registerTool(getVariablesTool);
    this.registerTool(evaluateExpressionTool);
    this.registerTool(listDebugSessionsTool);
    this.registerTool(disconnectDebugSessionTool);
    
    // Session management tools
    this.registerTool(getSessionInfoTool);
    this.registerTool(cleanupSessionsTool);
    
    // Breakpoint management tools
    this.registerTool(listBreakpointsTool);
    this.registerTool(clearBreakpointsTool);
    this.registerTool(getBreakpointStatsTool);
    
    // Debug logging tools
    this.registerTool(getDebugLogTool);
    this.registerTool(exportDebugLogTool);
    
    // Value tracking tools
    this.registerTool(trackValueTool);
    this.registerTool(getValueHistoryTool);
    this.registerTool(clearValueHistoryTool);
  }

  async cleanup(): Promise<void> {
    // Disconnect all sessions on shutdown
    for (const [sessionId, sessionInfo] of sessions) {
      try {
        await sessionInfo.session.disconnect(true);
      } catch (error) {
        console.error(`Error disconnecting session ${sessionId}:`, error);
      }
    }
    sessions.clear();
    valueHistory.clear();
    timeCheckpoints.clear();
  }
}

// Start the server
async function main() {
  const server = new DAPMcpServer();
  
  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    await server.cleanup();
    process.exit(0);
  });
  
  process.on("SIGTERM", async () => {
    await server.cleanup();
    process.exit(0);
  });

  // Periodic cleanup of stale sessions
  setInterval(async () => {
    try {
      const cleaned: string[] = [];
      const now = Date.now();
      const maxIdle = 30 * 60 * 1000; // 30 minutes

      for (const [sessionId, sessionInfo] of sessions) {
        const idle = now - sessionInfo.lastActivityAt.getTime();
        
        if (sessionInfo.state === SessionState.TERMINATED || 
            sessionInfo.state === SessionState.ERROR ||
            idle > maxIdle) {
          try {
            if (sessionInfo.state !== SessionState.TERMINATED) {
              await sessionInfo.session.disconnect(true);
            }
          } catch (error) {
            // Ignore errors during cleanup
          }
          sessions.delete(sessionId);
          cleaned.push(sessionId);
        }
      }

      if (cleaned.length > 0) {
        console.error(`Auto-cleaned ${cleaned.length} stale sessions: ${cleaned.join(", ")}`);
      }
    } catch (error) {
      console.error("Error during periodic cleanup:", error);
    }
  }, 5 * 60 * 1000); // Every 5 minutes

  await server.start();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});