# lsmcp - Language Service MCP

**LSP for headless AI Agents**

> ⚠️ **This project is under active development.** APIs and features may change without notice.

A unified MCP (Model Context Protocol) server that provides advanced code manipulation and analysis capabilities for multiple programming languages through Language Server Protocol integration.

## Features

- 🌍 **Multi-Language Support** - TypeScript, JavaScript, Rust, Python, Go, Moonbit, and more
- 🔍 **Semantic Code Analysis** - Go to definition, find references, type information
- ♻️ **Intelligent Refactoring** - Rename symbols, move files, with automatic import updates
- 🚀 **Auto-Detection** - Automatically detects project language and configures appropriate LSP
- 🔧 **Flexible Configuration** - Use with any LSP server via custom commands
- 🤖 **AI-Optimized** - Designed for LLMs with line and symbol-based interfaces

## Motivation

While AI assistants like Claude can see errors in the IDE, they cannot perform semantic refactorings such as Go to Definition or Rename without proper tooling.

This project provides AI with functionality equivalent to Language Server Protocol (LSP) features. Since LLMs are not good at precise position tracking, we provide these features through line numbers and symbol names instead of character offsets.

## Installation

### MCP Server Configuration

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "lsmcp": {
      "command": "npx",
      "args": ["lsmcp"]
    }
  }
}
```

For language-specific servers or custom configurations:

```json
{
  "mcpServers": {
    // Auto-detect language (recommended)
    "lsmcp": {
      "command": "npx",
      "args": ["lsmcp"]
    },
    // Or use specific language
    "rust": {
      "command": "npx",
      "args": ["lsmcp", "--language", "rust"]
    },
    // Or use custom LSP
    "deno": {
      "command": "npx",
      "args": ["lsmcp", "--bin", "deno lsp"]
    }
  }
}
```

### Quick Setup with --init=claude

The easiest way to automatically configure lsmcp for Claude Desktop:

```bash
npm install typescript lsmcp -D
npx lsmcp --init=claude
# Creates/updates .mcp.json with lsmcp configuration
# Creates/updates .claude/settings.json with permissions
```

After initialization, start Claude Desktop:

```bash
claude
```

### Manual Permissions Setup

If configuring manually, add permissions to `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      // lsmcp tools (TypeScript via Compiler API)
      "mcp__lsmcp__*",
      // Or specific tools
      "mcp__lsmcp__rename_symbol",
      "mcp__lsmcp__move_file",
      // TypeScript-specific server
      "mcp__typescript__*",
      // Language-specific tools
      "rust_*",
      "python_*",
      "go_*"
    ],
    "deny": []
  }
}
```

### Language Server Installation

Install the appropriate language server for your project:

```bash
# TypeScript/JavaScript
npm install -g typescript-language-server

# Rust
rustup component add rust-analyzer

# Python
pip install python-lsp-server

# Go
go install golang.org/x/tools/gopls@latest

# Moonbit - included with SDK
# Java - see jdtls docs
# C/C++ - apt install clangd
```

### Optional: AI Assistant Prompt

For better results with AI assistants, consider adding this to your prompt:

```markdown
## CRITICAL: Tool Usage Priority for Refactoring

**When performing refactoring operations on code, ALWAYS use language-specific MCP tools instead of the default Edit/Write tools.**

Specifically for refactoring:

- For renaming symbols: ALWAYS use `<language>_rename_symbol` instead of Edit/Write
- For moving files: ALWAYS use `<language>_move_file` (TypeScript only) instead of Bash(mv)
- For finding references: ALWAYS use `<language>_find_references` instead of Grep
- For type analysis: ALWAYS use `<language>_get_type_*` tools

**NEVER use Edit, MultiEdit, or Write tools for refactoring operations that have a corresponding MCP tool.**
```

## Migration from typescript-mcp to lsmcp

**Note:** The standalone `typescript-mcp` command has been replaced with the unified `lsmcp` (Language Server MCP) command. This change provides better multi-language support while maintaining all TypeScript functionality.

### Migration Guide

If you were using:

```bash
npx typescript-mcp
```

Now use:

```bash
npx lsmcp                    # Auto-detects TypeScript projects
# or explicitly:
npx lsmcp --language typescript
```

All TypeScript-specific features remain available through `lsmcp`. The tool will automatically detect TypeScript projects by looking for `tsconfig.json` or `package.json` files.

## Using lsmcp - Unified Language Server MCP

`lsmcp` is a unified CLI that supports multiple language servers through the `--language` flag or automatic detection.

### Basic Usage

```bash
# Auto-detect project language
npx lsmcp

# Specify language explicitly
npx lsmcp --language typescript
npx lsmcp -l rust
npx lsmcp -l moonbit

# Use custom LSP server
npx lsmcp --bin "deno lsp"
npx lsmcp --bin "rust-analyzer"

# Initialize for Claude Desktop
npx lsmcp --init claude

# Get diagnostics for multiple files using glob pattern
npx lsmcp --include "src/**/*.ts"
npx lsmcp --include "**/*.ts" --language typescript
```

### Batch Diagnostics with --include

The `--include` option allows you to get diagnostics for multiple files matching a glob pattern:

```bash
# Check all TypeScript files in src directory
npx lsmcp --include "src/**/*.ts"

# Check all TypeScript files in the project
npx lsmcp --include "**/*.ts"

# Check specific directory
npx lsmcp --include "src/components/*.ts"
```

Note: The `--include` option currently only supports TypeScript/JavaScript files.

### Custom LSP Server Examples

```bash
# Use Deno LSP for TypeScript
npx lsmcp --bin "deno lsp"

# Use TypeScript Native Preview (TSGO) for faster performance
npm install @typescript/native-preview
npx lsmcp --bin "npx @typescript/native-preview -- --lsp --stdio"

# Use custom rust-analyzer path
npx lsmcp --bin "/usr/local/bin/rust-analyzer"

# Use TypeScript LSP with custom tsserver path
npx lsmcp --bin "typescript-language-server --stdio --tsserver-path=/usr/local/lib/node_modules/typescript/lib"
```

### Experimental TSGO

For faster TypeScript performance, you can use TypeScript Native Preview:

```bash
npm install @typescript/native-preview
```

Then use it with lsmcp:

```bash
npx lsmcp --bin "npx @typescript/native-preview -- --lsp --stdio"
```

Or configure it in .mcp.json:

```json
{
  "mcpServers": {
    "typescript": {
      "env": {
        "TSGO": "true"
      },
      "command": "npx",
      "args": ["lsmcp"]
    }
  }
}
```

## Supported Languages

`lsmcp` supports multiple programming languages through their respective Language Server Protocol implementations:

### Built-in Language Support

| Language              | Detection Files                                  | LSP Server                 | Installation                                                        |
| --------------------- | ------------------------------------------------ | -------------------------- | ------------------------------------------------------------------- |
| TypeScript/JavaScript | `tsconfig.json`, `package.json`                  | typescript-language-server | `npm install -g typescript-language-server`                         |
| Rust                  | `Cargo.toml`                                     | rust-analyzer              | `rustup component add rust-analyzer`                                |
| Moonbit               | `moon.mod.json`                                  | Moonbit LSP                | Included with [Moonbit SDK](https://www.moonbitlang.com/download)   |
| Go                    | `go.mod`                                         | gopls                      | `go install golang.org/x/tools/gopls@latest`                        |
| Python                | `pyproject.toml`, `setup.py`, `requirements.txt` | pylsp                      | `pip install python-lsp-server`                                     |
| Java                  | `pom.xml`, `build.gradle`                        | jdtls                      | See [jdtls installation](https://github.com/eclipse/eclipse.jdt.ls) |
| C/C++                 | `CMakeLists.txt`, `Makefile`, `.c/.cpp/.h` files | clangd                     | `apt install clangd` or `brew install llvm`                         |

### Language-Specific Tools

Each language provides a consistent set of LSP-based tools with language-specific prefixes:

#### TypeScript/JavaScript (`typescript_` or via Compiler API)

- `rename_symbol` - Rename symbols across the codebase
- `move_file` - Move files and update imports
- `find_references` - Find all references to a symbol
- `get_diagnostics` - Get errors and warnings
- `get_type_at_symbol` - Get type information
- And more...

#### Other Languages (`<language>_` prefix)

- `<language>_get_hover` - Get hover information
- `<language>_find_references` - Find symbol references
- `<language>_rename_symbol` - Rename symbols
- `<language>_get_diagnostics` - Get diagnostics
- `<language>_get_document_symbols` - List document symbols
- And more LSP features...

### Available MCP Servers

1. **lsmcp** (Recommended) - Unified CLI with auto-detection

   ```bash
   npx lsmcp                    # Auto-detect language
   npx lsmcp -l typescript      # Specify language
   ```

2. **Language-specific servers** - Direct access to language features
   - `npx rust-mcp` - Rust language support
   - `npx moonbit-mcp` - Moonbit language support
   - `npx multi-language-mcp` - Multi-language with auto-detection
   - `npx generic-lsp-mcp` - Use any LSP via LSP_COMMAND

## Usage Examples

### TypeScript Project

```bash
cd my-typescript-project
npx lsmcp --init=claude
claude
```

Then in Claude:

```
# Rename a symbol
Use mcp__typescript__rename_symbol to rename the function "calculateTotal" to "computeSum" in src/utils.ts

# Find all references
Use mcp__typescript__find_references to find all uses of the "User" interface

# Get type information
Use mcp__typescript__get_type_at_symbol to show the type of "config" variable in app.ts line 15
```

### Rust Project

```bash
cd my-rust-project
npx lsmcp -l rust --init=claude
# or use rust-mcp directly
npx rust-mcp --init=claude
claude
```

Then in Claude:

```
Use rust_rename_symbol to rename the struct "Config" to "AppConfig"
Use rust_find_references to find all uses of the "parse_args" function
```

### Python Project

```bash
cd my-python-project
npx lsmcp --init=claude  # Auto-detects Python
claude
```

Then in Claude:

```
Use python_get_hover to show documentation for the "process_data" function
Use python_rename_symbol to rename the class "DataProcessor" to "DataHandler"
```

### Multi-Language Monorepo

```bash
cd my-monorepo
npx multi-language-mcp --init=claude
claude
```

The server will automatically detect and use the appropriate LSP based on the file being edited.

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

## Troubleshooting

### LSP Server Not Found

If you get an error about LSP server not found:

1. Ensure the language's LSP server is installed (see Installation section above)
2. Check if it's in your PATH: `which <lsp-command>`
3. Set the LSP path explicitly in environment variables

### Language Not Detected

If auto-detection fails:

1. Ensure your project has appropriate config files (see Supported Languages table)
2. Use `--language` flag to explicitly specify: `npx lsmcp -l python`
3. Set `FORCE_LANGUAGE` environment variable in your MCP configuration

### Performance Issues

- LSP servers may take time to index large projects on first run
- TypeScript projects benefit from using the native TypeScript compiler API
- Consider using language-specific servers for better performance
- Some LSP features may be limited compared to native TypeScript support

### MCP Connection Issues

If Claude can't connect to the MCP server:

1. Check that the server initialized correctly: `npx lsmcp --init=claude`
2. Verify `.mcp.json` exists in your project root
3. Ensure Claude Desktop has the correct permissions in `.claude/settings.json`
4. Try running the server manually to see error messages: `npx lsmcp`

## License

MIT
