# typescript-mcp

> ⚠️ **This project is under active development.** APIs and features may change without notice.

A specialized MCP (Model Context Protocol) server for TypeScript projects, providing advanced code manipulation and analysis capabilities.

## Features

- **Refactoring**: Symbol renaming, file moving, symbol deletion
- **Code Navigation**: Jump to definition, find references, get type signatures
- **Diagnostics**: Get TypeScript errors and warnings
- **Module Analysis**: List exported symbols from modules

## Usage

### Running as MCP Server

Add to your mcp settings:

```json
{
  "mcpServers": {
    "typescript-mcp": {
      "command": "npx",
      "args": ["-y", "typescript-mcp@latest"]
    }
  }
}
```

Add permissions in `.claude/settings.json`.

```json
{
  "permissions": {
    "allow": [
      "mcp__typescript__find-references",
      "mcp__typescript__get-definitions",
      "mcp__typescript__get-diagnostics",
      "mcp__typescript__get-module-symbols",
      "mcp__typescript__get-type-signature"
    ],
    "deny": []
  }
}
```

## MCP Tool Commands

When using this MCP server in Claude, the tools are available with the `mcp__typescript__` prefix:

- `mcp__typescript__move-file` - Move TypeScript/JavaScript files
- `mcp__typescript__rename-symbol` - Rename symbols across the project
- `mcp__typescript__delete-symbol` - Delete symbols and their references
- `mcp__typescript__find-references` - Find all references to a symbol
- `mcp__typescript__get-definitions` - Get symbol definitions
- `mcp__typescript__get-diagnostics` - Get TypeScript diagnostics
- `mcp__typescript__get-module-symbols` - List module exports
- `mcp__typescript__get-type-signature` - Get detailed type signatures

## Develop

```bash
# Install dependencies
pnpm install

# Build
pnpm build
```

## License

MIT
