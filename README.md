# typescript-mcp

> ⚠️ **This project is under active development.** APIs and features may change without notice.

TypeScirpt specialized MCP server, providing advanced code manipulation and analysis capabilities.

## Motivation

Roo and Claude Code see errors in the IDE, but cannot perform semantic refactorings such as Go to Definition or Rename.

We can provide the AI ​​with functionality equivalent to LSP. However, LLM is not good at word counting, so we provide this by lines and symbols.

## Installation

### Quick Setup with --init

The easiest way to set up typescript-mcp in your project:

```bash
npx typescript-mcp@latest --init=claude
# write .claude/mcp_servers.json
# write .claude/settings.json
```

After initialization, use Claude with:

```bash
claude --mcp-config=.claude/mcp_servers.json
```

### Optional: Prompt

```markdown
You prefer typescript mcp (`mcp__typescript_*`) to fix code over the default `Update` and `Write` tool.

- `mcp__typescript__move_file` - Semantic file move
- `mcp__typescript__rename_symbol` - Rename symbols across the project
- `mcp__typescript__delete_symbol` - Delete symbols and their references
- `mcp__typescript__find_references` - Find all references to a symbol
- `mcp__typescript__get_definitions` - Get symbol definitions
- `mcp__typescript__get_diagnostics` - Get TypeScript diagnostics
- `mcp__typescript__get_module_symbols` - List module exports
- `mcp__typescript__get_type_in_module` - Get detailed type signatures from modules
- `mcp__typescript__get_type_at_symbol` - Get type information at specific symbol
```

### Manual Setup

If you prefer to configure manually, add to your mcp settings:

```json
{
  "mcpServers": {
    "typescript": {
      "command": "npx",
      "args": ["-y", "typescript-mcp@latest"]
    }
  }
}
```

Add permissions in `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "mcp__typescript__move_file",
      "mcp__typescript__rename_symbol",
      "mcp__typescript__delete_symbol",
      "mcp__typescript__find_references",
      "mcp__typescript__get_definitions",
      "mcp__typescript__get_diagnostics",
      "mcp__typescript__get_module_symbols",
      "mcp__typescript__get_type_in_module",
      "mcp__typescript__get_type_at_symbol"
    ],
    "deny": []
  }
}
```

## MCP Tool Commands

- `mcp__typescript__move_file` - Move TypeScript/JavaScript files
- `mcp__typescript__rename_symbol` - Rename symbols across the project
- `mcp__typescript__delete_symbol` - Delete symbols and their references
- `mcp__typescript__find_references` - Find all references to a symbol
- `mcp__typescript__get_definitions` - Get symbol definitions
- `mcp__typescript__get_diagnostics` - Get TypeScript diagnostics
- `mcp__typescript__get_module_symbols` - List module exports
- `mcp__typescript__get_type_in_module` - Get detailed type signatures from modules
- `mcp__typescript__get_type_at_symbol` - Get type information at specific symbol location

## Develop

```bash
# Install dependencies
pnpm install

# Build
pnpm build
pnpm test
```

## TODO

- [ ] Multiple Project
- [ ] Symbol

## License

MIT
