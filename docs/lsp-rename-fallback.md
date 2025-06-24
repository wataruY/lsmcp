# LSP Rename with TypeScript Fallback

## Overview

The LSP rename tool (`lsp_rename_symbol`) now includes automatic fallback to the TypeScript rename tool when the LSP server doesn't support the rename operation. This is particularly useful for TypeScript Native Preview LSP, which doesn't yet support rename functionality.

## How It Works

1. **First Attempt**: Try to rename using the LSP server
2. **Fallback Detection**: If the LSP server returns:
   - Error code `-32601` (Method not found)
   - "Unhandled method" error
   - "Method not found" error
   - `null` result
3. **Automatic Fallback**: Seamlessly switch to TypeScript rename tool
4. **Transparent Result**: User gets the rename result regardless of which tool was used

## Benefits

- **Seamless Experience**: Users don't need to know which LSP server they're using
- **Best of Both Worlds**: Use LSP when available, TypeScript API when not
- **Future Proof**: When TypeScript Native Preview adds rename support, it will automatically use it
- **Consistent Interface**: Same tool, same parameters, works everywhere

## Usage

```typescript
// Works with any LSP server
tool: lsp_rename_symbol
arguments:
  root: "/path/to/project"
  filePath: "src/utils.ts"
  line: 10
  target: "oldName"
  newName: "newName"
```

## Implementation Details

### LSP Client Enhancement

Added `prepareRename` and `rename` methods to the LSP client:

```typescript
prepareRename: (uri: string, position: Position) => Promise<Range | null>;
rename: (uri: string, position: Position, newName: string) => Promise<WorkspaceEdit | null>;
```

### Error Handling

The rename method gracefully handles:
- LSP servers that don't support rename
- LSP servers that return null/empty results
- Network or communication errors

### Fallback Logic

```typescript
try {
  // Try LSP rename
  workspaceEdit = await client.rename(uri, position, newName);
} catch (error) {
  if (isRenameNotSupported(error)) {
    // Fall back to TypeScript tool
    return tsRenameSymbolTool.execute(...);
  }
  throw error; // Re-throw other errors
}

if (!workspaceEdit) {
  // LSP returned null, use fallback
  return tsRenameSymbolTool.execute(...);
}
```

## Testing

The implementation includes comprehensive tests:
- Tests with LSP servers that support rename
- Tests with LSP servers that don't support rename
- Tests for various error scenarios
- Tests for successful fallback execution

## Future Improvements

1. **Performance**: Cache LSP capabilities to avoid repeated attempts
2. **User Notification**: Option to notify users when fallback is used
3. **Statistics**: Track which LSP servers need fallback most often
4. **Smart Selection**: Choose the best tool based on file type and LSP capabilities