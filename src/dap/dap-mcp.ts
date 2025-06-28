#!/usr/bin/env node
/**
 * DAP MCP Server - Debug Adapter Protocol tools for MCP
 */

import { z } from "zod";
import { BaseMcpServer, ToolDef } from "../mcp/_mcplib.ts";
import { createDebugSession, DebugSession } from "./index.ts";
import type { StoppedEvent, Variable, StackFrame, Scope } from "./types.ts";

// Active debug sessions
const sessions = new Map<string, DebugSession>();

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
  }),
  execute: async (args) => {
    if (sessions.has(args.sessionId)) {
      throw new Error(`Session ${args.sessionId} already exists`);
    }

    const session = createDebugSession({
      adapter: args.adapter,
      adapterArgs: args.adapterArgs,
      clientID: `mcp-dap-${args.sessionId}`,
      clientName: "MCP DAP Server",
    });

    sessions.set(args.sessionId, session);

    // Set up event handlers
    const events: string[] = [];
    
    session.on("stopped", (event: StoppedEvent) => {
      events.push(`Stopped: ${event.reason} at thread ${event.threadId}`);
    });

    session.on("output", (event) => {
      events.push(`Output [${event.category}]: ${event.output.trim()}`);
    });

    session.on("terminated", () => {
      events.push("Program terminated");
    });

    try {
      await session.connect();
      await session.launch(args.program, {
        args: args.args,
        env: args.env,
        cwd: args.cwd,
        stopOnEntry: args.stopOnEntry,
        noDebug: false,
      });

      return `Debug session ${args.sessionId} launched for ${args.program}`;
    } catch (error) {
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
  }),
  execute: async (args) => {
    if (sessions.has(args.sessionId)) {
      throw new Error(`Session ${args.sessionId} already exists`);
    }

    const session = createDebugSession({
      adapter: args.adapter,
      adapterArgs: args.adapterArgs,
      clientID: `mcp-dap-${args.sessionId}`,
      clientName: "MCP DAP Server",
    });

    sessions.set(args.sessionId, session);

    try {
      await session.connect();
      await session.attach({
        processId: args.processId,
        port: args.port,
        host: args.host,
      });

      return `Debug session ${args.sessionId} attached`;
    } catch (error) {
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
    const session = sessions.get(args.sessionId);
    if (!session) {
      throw new Error(`Session ${args.sessionId} not found`);
    }

    await session.setBreakpoints(args.source, args.lines, args.conditions);
    
    return `Set ${args.lines.length} breakpoints in ${args.source}`;
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
    const session = sessions.get(args.sessionId);
    if (!session) {
      throw new Error(`Session ${args.sessionId} not found`);
    }

    await session.continue(args.threadId);
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
    const session = sessions.get(args.sessionId);
    if (!session) {
      throw new Error(`Session ${args.sessionId} not found`);
    }

    await session.stepOver(args.threadId);
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
    const session = sessions.get(args.sessionId);
    if (!session) {
      throw new Error(`Session ${args.sessionId} not found`);
    }

    await session.stepIn(args.threadId);
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
    const session = sessions.get(args.sessionId);
    if (!session) {
      throw new Error(`Session ${args.sessionId} not found`);
    }

    await session.stepOut(args.threadId);
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
    const session = sessions.get(args.sessionId);
    if (!session) {
      throw new Error(`Session ${args.sessionId} not found`);
    }

    await session.pause(args.threadId);
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
    const session = sessions.get(args.sessionId);
    if (!session) {
      throw new Error(`Session ${args.sessionId} not found`);
    }

    const stackFrames = await session.getStackTrace(args.threadId);
    
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
    const session = sessions.get(args.sessionId);
    if (!session) {
      throw new Error(`Session ${args.sessionId} not found`);
    }

    const scopes = await session.getScopes(args.frameId);
    
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
      const variables = await session.getVariables(scope.variablesReference);
      
      for (const variable of variables) {
        result.push(formatVariable(variable, "  "));
        
        // Get nested variables if they exist
        if (variable.variablesReference > 0) {
          const nested = await session.getVariables(variable.variablesReference);
          for (const nestedVar of nested.slice(0, 5)) { // Limit nested display
            result.push(formatVariable(nestedVar, "    "));
          }
          if (nested.length > 5) {
            result.push(`    ... and ${nested.length - 5} more`);
          }
        }
      }
    }

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
    const session = sessions.get(args.sessionId);
    if (!session) {
      throw new Error(`Session ${args.sessionId} not found`);
    }

    try {
      const result = await session.evaluate(
        args.expression, 
        args.frameId,
        args.context || "repl"
      );
      
      return `${args.expression} = ${result}`;
    } catch (error) {
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

    const sessionList = Array.from(sessions.keys())
      .map(id => `- ${id}`)
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
    const session = sessions.get(args.sessionId);
    if (!session) {
      throw new Error(`Session ${args.sessionId} not found`);
    }

    await session.disconnect(args.terminateDebuggee ?? true);
    sessions.delete(args.sessionId);
    
    return `Debug session ${args.sessionId} disconnected`;
  },
};

// Helper function to format variables
function formatVariable(variable: Variable, indent: string): string {
  let result = `${indent}${variable.name}: ${variable.value}`;
  if (variable.type) {
    result += ` (${variable.type})`;
  }
  return result;
}

// Create and configure the MCP server
class DAPMcpServer extends BaseMcpServer {
  constructor() {
    super({
      name: "dap-mcp",
      version: "1.0.0",
      description: "Debug Adapter Protocol MCP server for debugging programs"
    });
    this.setupHandlers();
  }

  protected setupHandlers(): void {
    
    // Register all tools
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
  }

  async cleanup(): Promise<void> {
    // Disconnect all sessions on shutdown
    for (const [sessionId, session] of sessions) {
      try {
        await session.disconnect(true);
      } catch (error) {
        console.error(`Error disconnecting session ${sessionId}:`, error);
      }
    }
    sessions.clear();
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

  await server.start();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});