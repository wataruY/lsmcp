# LSP Client Manager

A simplified interface for managing Language Server Protocol (LSP) clients with automatic process pooling.

## Usage

### Simple Interface

The main API requires only a project path:

```typescript
import { getTypeScriptLSPClient } from "./lsp/lsp_client_manager";

// Get a client for your project
const client = getTypeScriptLSPClient("/path/to/project");

// Use the client
const refs = await client.findReferences(fileUri, position);
const definition = await client.getDefinition(fileUri, position);
const hover = await client.getHover(fileUri, position);
const diagnostics = await client.getDiagnostics(fileUri);

// Cleanup when done
await client.shutdown();
```

### For Complex Operations

Use `withClient` for multiple operations with the same LSP connection:

```typescript
const result = await client.withClient(async (lspClient) => {
  // Direct access to the underlying LSP client
  lspClient.openDocument(uri, content);
  
  const refs = await lspClient.findReferences(uri, position);
  const hover = await lspClient.getHover(uri, position);
  
  return { refs, hover };
});
```

### tsgo Support

Same simple interface for tsgo (TypeScript implementation in Go):

```typescript
import { getTsgoLSPClient } from "./lsp/lsp_client_manager";

const client = getTsgoLSPClient("/path/to/project");
// Same API as TypeScript client
```

## Features

- **Automatic Process Pooling**: Reuses LSP server processes for better performance
- **Simple API**: Just provide a project path, everything else is handled
- **Automatic Cleanup**: Processes are cleaned up on idle timeout or exit
- **Multiple LSP Support**: TypeScript and tsgo out of the box

## Implementation Details

The client manager handles all complexity internally:
- Process spawning and lifecycle management
- Connection pooling (max 3 processes per project)
- Idle timeout (5 minutes by default)
- Automatic cleanup on process exit

All you need is a project path!