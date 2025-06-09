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

## Usage Examples

```bash
# start with config
$ claude --mcp-config=./claude/mcp_settings.json

# Rename symbol
> examples/scratch.ts foo to bar
● typescript:rename_symbol (MCP)(root: "~/sandbox/cla
                                ude-mcp", filePath:
                                "examples/scratch.ts", line: 6,
                                oldName: "foo", newName: "bar")
  ⎿ Successfully renamed symbol "foo" to "bar" in 1 file(s) with
     2 change(s).

    Changes:
      examples/scratch.ts:

# Rename file
● typescript:move_file (MCP)(root: "~/s
                            andbox/claude-mcp",
                            oldPath: "examples/oth
                            er-types.ts", newPath:
                             "examples/types.ts")
  ⎿ Successfully moved file from "~/san
    dbox/claude-mcp/examples/other-types.ts" to
    "~/sandbox/claude-mcp/examples/type
    s.ts". Updated imports in 2 file(s).

    Changes:
      File moved: examples/other-types.ts →
    examples/types.ts

## Get definitions
> get toMcpHandler definitions
● typescript:get_definitions (MCP)(root: "/home/mi
                                  zchi/sandbox/cla
                                  ude-mcp",
                                  filePath: "src/m
                                  cp/mcp_server_ut
                                  ils.test.ts",
                                  line: 2,
                                  symbolName: "toM
                                  cpToolHandler")

  ⎿ Found 1 definition for symbol
    "toMcpToolHandler"
    Symbol: toMcpToolHandler (Identifier)

    Definitions:
      src/mcp/mcp_server_utils.ts:15:1 - export
    function toMcpToolHandler<T>(

```

## MCP Tool Commands

- `mcp__typescript__move_file` - Move file
- `mcp__typescript__move_directory` - Move directory
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
