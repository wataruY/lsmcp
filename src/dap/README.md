# DAP Client Library

A TypeScript implementation of the Debug Adapter Protocol (DAP) client for communicating with debug adapters.

## Installation

```typescript
import { createDebugSession } from "@mizchi/lsmcp/dap";
```

## Quick Start

```typescript
import { createDebugSession } from "./dap/index.ts";

// Create a debug session
const session = await createDebugSession({
  adapter: "node",
  clientID: "my-debugger",
  clientName: "My Debug Client",
});

// Connect and initialize
await session.connect();

// Set breakpoints
await session.setBreakpoints("/path/to/file.js", [10, 20]);

// Launch program
await session.launch("/path/to/program.js", {
  args: ["--verbose"],
  env: { DEBUG: "true" },
});

// Listen for events
session.on("stopped", async (event) => {
  console.log("Stopped at:", event);
  
  // Get variables
  const stackFrames = await session.getStackTrace();
  const scopes = await session.getScopes();
  
  for (const scope of scopes) {
    const variables = await session.getVariables(scope.variablesReference);
    console.log(`${scope.name}:`, variables);
  }
  
  // Evaluate expression
  const result = await session.evaluate("myVariable + 1");
  console.log("Result:", result);
  
  // Continue execution
  await session.continue();
});

session.on("terminated", () => {
  console.log("Debug session ended");
});
```

## API Reference

### createDebugSession(options)

Creates a new debug session.

Options:
- `adapter`: Debug adapter command (e.g., "node", "python")
- `adapterArgs?`: Arguments for the debug adapter
- `clientID?`: Client identification
- `clientName?`: Client display name
- `locale?`: Message locale
- `supportsVariableType?`: Whether to support variable types
- `supportsVariablePaging?`: Whether to support variable paging

### DebugSession Methods

#### Connection
- `connect()`: Connect and initialize the debug session
- `disconnect(terminateDebuggee?)`: End the debug session

#### Breakpoints
- `setBreakpoints(source, lines, conditions?)`: Set breakpoints in a file

#### Execution Control
- `launch(program, args?)`: Launch a program for debugging
- `attach(args)`: Attach to a running process
- `continue(threadId?)`: Resume execution
- `stepOver(threadId?)`: Step to next line
- `stepIn(threadId?)`: Step into function
- `stepOut(threadId?)`: Step out of function
- `pause(threadId?)`: Pause execution

#### Inspection
- `getStackTrace(threadId?)`: Get current stack frames
- `getScopes(frameId?)`: Get variable scopes
- `getVariables(reference)`: Get variables for a scope
- `evaluate(expression, frameId?, context?)`: Evaluate an expression

#### Events
- `on(event, listener)`: Subscribe to debug events
- `off(event, listener)`: Unsubscribe from debug events

### Low-Level API

For advanced usage, you can use the DAPClient directly:

```typescript
import { DAPClient } from "./dap/index.ts";

const client = new DAPClient();
await client.connect("node", ["--inspect"]);
await client.initialize({ clientID: "my-client" });

// Send any DAP request
const response = await client.sendRequest("threads");
console.log("Threads:", response.threads);
```

## Supported Debug Adapters

This client can work with any DAP-compliant debug adapter:

- **Node.js**: Built-in inspector or `node-debug2`
- **Python**: `debugpy`
- **C/C++**: `cppdbg`, `lldb-vscode`
- **Go**: `dlv`
- **Rust**: `lldb-vscode`, `codelldb`
- **Java**: `java-debug`
- **PHP**: `vscode-php-debug`

## Testing

See the `__tests__` directory for comprehensive examples and test implementations.

## Types

All DAP protocol types are exported from `./types.ts` for TypeScript users.