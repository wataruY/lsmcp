# DAP (Debug Adapter Protocol) Tests

This directory contains test implementations for the DAP client and mock servers.

## Test Files

### 1. `basic-connection.test.ts`
Basic DAP client connection and message exchange test.
- Tests client-server connection
- Basic request/response flow
- Event handling

### 2. `variable-inspection.test.ts`
Tests for variable inspection capabilities.
- Scopes (locals, globals)
- Nested objects and arrays
- Variable types and values

### 3. `code-evaluation.test.ts`
Tests for evaluating expressions in debug context.
- Simple expressions
- Variable references
- Property access

### 4. `step-execution.test.ts`
Tests for step-by-step execution control.
- Step over (next)
- Step into
- Step out
- Continue

### Mock Servers

### `mock-dap-server.ts`
Basic mock DAP server for simple protocol testing.

### `enhanced-mock-dap-server.ts`
Full-featured mock DAP server with:
- Variable inspection
- Expression evaluation
- Step execution
- Stack trace management

## Running Tests

```bash
# Start mock server
npx tsx src/dap/__tests__/enhanced-mock-dap-server.ts

# In another terminal, run tests
npx tsx src/dap/__tests__/basic-connection.test.ts
npx tsx src/dap/__tests__/variable-inspection.test.ts
# etc.
```

## Implementation Status

✅ **Implemented**:
- Basic DAP client (`../dapClient.ts`)
- Connection and initialization
- Breakpoint management
- Variable inspection with nested support
- Expression evaluation
- Step execution (in/over/out)
- Stack trace and scopes
- Event handling

🚧 **TODO**:
- Integration with real debug adapters (Node.js, Python, etc.)
- Memory inspection
- Conditional breakpoints
- Watch expressions
- Exception handling
- Multi-threaded debugging