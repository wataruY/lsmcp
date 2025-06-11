# typescript-mcp

> ⚠️ **This project is under active development.** APIs and features may change without notice.

TypeScript specialized MCP server, providing advanced code manipulation and analysis capabilities.

## Motivation

Roo and Claude Code see errors in the IDE, but cannot perform semantic refactorings such as Go to Definition or Rename.

We can provide the AI ​​with functionality equivalent to LSP. However, LLM is not good at word counting, so we provide this by lines and symbols.

## Installation

### Quick Setup with --init=claude

The easiest way to set up typescript-mcp in your project:

```bash
npm install typescript typescript-mcp -D
npx typescript-mcp --init=claude
# Creates/updates .mcp.json with typescript-mcp configuration
# Creates/updates .claude/settings.json with permissions
```

After initialization, use Claude with:

```bash
claude
```

### Optional: Prompt

```markdown
## CRITICAL: Tool Usage Priority for Refactoring

**When performing refactoring operations (rename, move, etc.) on TypeScript code, ALWAYS use typescript MCP tools (`mcp__typescript_*`) instead of the default Edit/Write tools.**

Specifically for refactoring:

- For renaming symbols: ALWAYS use `mcp__typescript__rename_symbol` instead of Edit/Write
- For moving files: ALWAYS use `mcp__typescript__move_file` instead of Bash(mv) or Write
- For moving directories: ALWAYS use `mcp__typescript__move_directory` instead of Bash(mv)
- For finding references: ALWAYS use `mcp__typescript__find_references` instead of Grep/Bash(grep)
- For type analysis: ALWAYS use `mcp__typescript__get_type_*` tools

**NEVER use Edit, MultiEdit, or Write tools for TypeScript refactoring operations that have a corresponding mcp\__typescript_\* tool.**
```

### Manual Setup

If you prefer to configure manually, add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "typescript": {
      "command": "npx",
      "args": ["typescript-mcp"]
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
      "mcp__typescript__move_directory",
      "mcp__typescript__rename_symbol",
      "mcp__typescript__delete_symbol",
      "mcp__typescript__find_references",
      "mcp__typescript__get_definitions",
      "mcp__typescript__get_diagnostics",
      "mcp__typescript__get_module_symbols",
      "mcp__typescript__get_type_in_module",
      "mcp__typescript__get_type_at_symbol",
      "mcp__typescript__get_symbols_in_scope"
    ],
    "deny": []
  }
}
```

### Experimental TSGO

`npm add @typescript/native-preview`

.mcp.json

```json
{
  "mcpServers": {
    "typescript": {
      "env": {
        "TSGO": "true"
      },
      "command": "npx",
      "args": ["typescript-mcp"]
    }
  }
}
```

```json
      "mcp__typescript__lsp_find_references",
      "mcp__typescript__lsp_get_definitions",
      "mcp__typescript__lsp_zget_diagnostics",
```

## Usage Examples

```bash
# start with config
$ claude

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
