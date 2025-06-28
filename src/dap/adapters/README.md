# DAP Adapters

This directory contains Debug Adapter Protocol (DAP) adapter implementations that translate between DAP and language-specific debugging protocols.

## Node.js DAP Adapter

The Node.js DAP adapter (`node-dap-adapter.ts`) translates between the Debug Adapter Protocol and Chrome DevTools Protocol (CDP) used by Node.js's built-in inspector.

### Features

- **Launch debugging**: Start Node.js programs with `--inspect-brk` flag
- **Breakpoints**: Set, remove, and hit breakpoints with optional conditions
- **Stepping**: Step over, step into, step out operations
- **Variables**: Inspect local and global variables, including nested objects
- **Stack traces**: View call stacks with source locations
- **Evaluation**: Evaluate expressions in the current debug context
- **Console output**: Capture stdout, stderr, and console.log output

### Architecture

1. **DAP Interface**: Receives DAP messages on stdin, sends responses on stdout
2. **CDP Translation**: Connects to Node.js inspector via WebSocket
3. **Protocol Mapping**: Maps between DAP concepts and CDP equivalents

### Usage

The adapter can be used in two ways:

1. **As a built-in adapter**: Simply specify `adapter: "node"` when creating a debug session
2. **As a standalone process**: Run directly with Node.js

```typescript
// Using as built-in adapter
const session = createDebugSession({
  adapter: "node",
  clientID: "my-debugger",
  clientName: "My Debugger",
});

// Using as standalone process
const session = createDebugSession({
  adapter: "/path/to/node-dap-adapter.ts",
  clientID: "my-debugger",
  clientName: "My Debugger",
});
```

### Testing

Run the test script to verify the adapter works correctly:

```bash
# Build the project first
pnpm build

# Run the test
node examples/dap/test-node-dap-adapter.ts
```

### Implementation Details

- **WebSocket Handshake**: Implements WebSocket protocol from scratch using raw TCP sockets
- **Frame Parsing**: Handles WebSocket frame parsing and masking
- **Script Management**: Maps between CDP script IDs and file paths
- **Variable References**: Encodes frame and scope indices for variable retrieval

### Future Improvements

- Support for source maps
- Better handling of async/await debugging
- Support for worker threads
- Memory profiling capabilities
- Performance profiling integration