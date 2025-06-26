# lsmcp - Language Service MCP

**LSP for headless AI Agents**

> ⚠️ **This project is under active development.** APIs and features may change without notice.

A unified MCP (Model Context Protocol) server that provides advanced code manipulation and analysis capabilities for multiple programming languages through Language Server Protocol integration.

## Features

- 🌍 **Multi-Language Support** - Built-in TypeScript/JavaScript, extensible to any language via LSP
- 🔍 **Semantic Code Analysis** - Go to definition, find references, type information
- ♻️ **Intelligent Refactoring** - Rename symbols, move files, with automatic import updates
- 🔧 **Flexible Configuration** - Use with any LSP server via `--bin` option
- 🤖 **AI-Optimized** - Designed for LLMs with line and symbol-based interfaces
- ⚡ **Fast Symbol Search** - Project-wide symbol index with real-time file watching
- 🎯 **Smart Import Suggestions** - Find and suggest import candidates with relative paths

See [Language Support Matrix](docs/LANGUAGE_SUPPORT_MATRIX.md) for detailed information about available tools for each language.

See [Language Support Matrix](docs/LANGUAGE_SUPPORT_MATRIX.md) for detailed information about available tools for each language.

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
      "args": ["-y", "@mizchi/lsmcp", "--language", "typescript"]
    }
  }
}
```

For other languages, use the `--bin` option with your LSP server:

```json
{
  "mcpServers": {
    // Rust via rust-analyzer
    "rust": {
      "command": "npx",
      "args": ["-y", "@mizchi/lsmcp", "--bin", "rust-analyzer"]
    },
    // Python via pylsp
    "python": {
      "command": "npx",
      "args": ["-y", "@mizchi/lsmcp", "--bin", "pylsp"]
    },
    // Deno via built-in LSP
    "deno": {
      "command": "npx",
      "args": ["-y", "@mizchi/lsmcp", "--bin", "deno lsp"]
    }
  }
}
```

### Quick Setup with --init=claude

The easiest way to automatically configure lsmcp for Claude Desktop:

```bash
npm install typescript @mizchi/lsmcp -D
npx -y @mizchi/lsmcp --init=claude --language=<language>
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
      // Allow all lsmcp tools
      "mcp__lsmcp__lsmcp_*",
      // TypeScript-specific server (when using --language typescript)
      "mcp__typescript__lsmcp_*"
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

**When performing refactoring operations on code, ALWAYS use MCP tools instead of the default Edit/Write tools.**

For TypeScript/JavaScript projects:
- For renaming symbols: ALWAYS use `lsmcp_rename_symbol` instead of Edit/Write
- For moving files: ALWAYS use `lsmcp_move_file` instead of Bash(mv)
- For finding references: ALWAYS use `lsmcp_find_references` instead of Grep
- For type analysis: ALWAYS use `lsmcp_get_type_*` tools

For other languages (using LSP):
- For renaming symbols: ALWAYS use `lsmcp_rename_symbol` instead of Edit/Write
- For finding references: ALWAYS use `lsmcp_find_references` instead of Grep
- For diagnostics: ALWAYS use `lsmcp_get_diagnostics`

**NEVER use Edit, MultiEdit, or Write tools for refactoring operations that have a corresponding MCP tool.**
```

## Quick Start

### TypeScript/JavaScript Projects

```bash
# Install and configure for Claude Desktop
npm install typescript @mizchi/lsmcp -D
npx -y @mizchi/lsmcp --init=claude --language=typescript
clauder
```

### Other Languages

```bash
# Rust
npx -y @mizchi/lsmcp --init=claude --bin="rust-analyzer"

# Python
npx -y @mizchi/lsmcp --init=claude --bin="pylsp"

# Go
npx -y @mizchi/lsmcp --init=claude --bin="gopls"
```

## Usage

### Command Line Options

```bash
# TypeScript/JavaScript (built-in support)
npx -y @mizchi/lsmcp --language typescript
npx -y @mizchi/lsmcp -l javascript

# Other languages via LSP servers
npx -y @mizchi/lsmcp --bin "rust-analyzer"      # Rust
npx -y @mizchi/lsmcp --bin "pylsp"              # Python
npx -y @mizchi/lsmcp --bin "gopls"              # Go
npx -y @mizchi/lsmcp --bin "clangd"             # C/C++
npx -y @mizchi/lsmcp --bin "jdtls"              # Java
npx -y @mizchi/lsmcp --bin "deno lsp"           # Deno

# Initialize for Claude
npx -y @mizchi/lsmcp --init=claude --language=typescript
npx -y @mizchi/lsmcp --init=claude --bin="rust-analyzer"

# Get diagnostics for multiple files using glob pattern (requires --language)
npx -y @mizchi/lsmcp --include "src/**/*.ts" --language typescript
npx -y @mizchi/lsmcp --include "**/*.ts" --language typescript
```

### Batch Diagnostics with --include

The `--include` option allows you to get diagnostics for multiple files matching a glob pattern:

```bash
# Check all TypeScript files in src directory
npx -y @mizchi/lsmcp --include "src/**/*.ts" --language typescript

# Check all TypeScript files in the project
npx -y @mizchi/lsmcp --include "**/*.ts" --language typescript

# Check specific directory
npx -y @mizchi/lsmcp --include "src/components/*.ts" --language typescript
```

Note: The `--include` option currently only supports TypeScript/JavaScript files and requires `--language` to be specified.

### Advanced Usage

#### Custom LSP Servers

```bash
# Use Deno LSP for TypeScript
npx -y @mizchi/lsmcp --bin "deno lsp"

# Use TypeScript LSP with custom tsserver path
npx -y @mizchi/lsmcp --bin "typescript-language-server --stdio --tsserver-path=/custom/path"
```

#### Environment Variables

- `PROJECT_ROOT` - Override the project root directory
- `LSP_COMMAND` - Override the LSP command for TypeScript server
- `FORCE_LSP` - Force TypeScript server to use LSP mode instead of Compiler API
- `DEBUG` - Enable debug output including detailed error information

#### Error Handling

lsmcp provides user-friendly error messages with solutions:

```bash
# Example: LSP server not found
$ npx @mizchi/lsmcp --bin "rust-analyzer"
Error: LSP server for rust not found
Reason: The language server is not installed or not in PATH
Solution: Install it with: rustup component add rust-analyzer

# Example: File not found
Error: File not found: src/test.ts
Reason: The specified file does not exist
Solution: Check the file path and ensure it exists. Use relative paths from the project root.

# Example: Symbol not found
Error: Symbol not found: myFunction
Reason: The specified symbol does not exist at the given location
Solution: Ensure the symbol name is spelled correctly and exists at the specified line.
```

## Language-Specific Setup

### TypeScript/JavaScript

#### Prerequisites

```bash
# Install TypeScript language server
npm add typescript-language-server typescript
```

#### Quick Setup

```bash
cd my-typescript-project
npx -y @mizchi/lsmcp --init=claude --language=typescript
claude
```

#### Available Tools

TypeScript/JavaScript supports all tools. See [Language Support Matrix](docs/LANGUAGE_SUPPORT_MATRIX.md) for details.

**TypeScript-specific tools** (via Compiler API):
- `lsmcp_move_file` - Move files and update imports
- `lsmcp_move_directory` - Move directories and update imports
- `lsmcp_delete_symbol` - Delete symbols and their references
- `lsmcp_get_type_at_symbol` - Get detailed type information
- `lsmcp_get_module_symbols` - List all exports from a module

**Common LSP tools**:
- `lsmcp_rename_symbol` - Rename symbols across the codebase
- `lsmcp_find_references` - Find all references to a symbol
- `lsmcp_get_diagnostics` - Get errors and warnings
- `lsmcp_get_hover` - Get documentation and type info
- `lsmcp_get_definitions` - Go to definition

#### Example Usage in Claude

```
Use lsmcp_rename_symbol to rename the function "calculateTotal" to "computeSum" in src/utils.ts
Use lsmcp_find_references to find all uses of the "User" interface
```

### Rust

#### Prerequisites

```bash
# Install rust-analyzer
rustup component add rust-analyzer
```

#### Configuration

Create `.mcp.json` in your Rust project:

```json
{
  "mcpServers": {
    "rust-lsp": {
      "command": "npx",
      "args": ["-y", "@mizchi/lsmcp", "--bin", "rust-analyzer"]
    }
  }
}
```

#### Available LSP Tools

- `lsmcp_get_hover` - Get type information and documentation
- `lsmcp_find_references` - Find all references to a symbol
- `lsmcp_rename_symbol` - Rename symbols across the codebase
- `lsmcp_get_diagnostics` - Get compilation errors and warnings
- `lsmcp_get_definitions` - Go to definition
- `lsmcp_get_document_symbols` - List all symbols in a file
- `lsmcp_get_completion` - Get code completions
- `lsmcp_format_document` - Format code using rustfmt
- `lsmcp_get_code_actions` - Get available code actions

#### Example Usage in Claude

```
Use lsmcp_rename_symbol to rename the struct "Config" to "AppConfig"
Use lsmcp_find_references to find all uses of the "parse_args" function
```

### Python

#### Prerequisites

```bash
# Install Python LSP server
pip install python-lsp-server
```

#### Configuration

Create `.mcp.json` in your Python project:

```json
{
  "mcpServers": {
    "python-lsp": {
      "command": "npx",
      "args": ["-y", "@mizchi/lsmcp", "--bin", "pylsp"]
    }
  }
}
```

#### Available LSP Tools

- `lsmcp_get_hover` - Get documentation and type information
- `lsmcp_find_references` - Find all references to a symbol
- `lsmcp_rename_symbol` - Rename symbols across the codebase
- `lsmcp_get_diagnostics` - Get syntax and type errors
- `lsmcp_get_definitions` - Go to definition
- `lsmcp_get_document_symbols` - List all symbols in a file
- `lsmcp_get_completion` - Get code completions
- `lsmcp_format_document` - Format code
- `lsmcp_get_code_actions` - Get available code actions

#### Example Usage in Claude

```
Use lsmcp_get_hover to show documentation for the "process_data" function
Use lsmcp_rename_symbol to rename the class "DataProcessor" to "DataHandler"
```

### Go

#### Prerequisites

```bash
# Install gopls
go install golang.org/x/tools/gopls@latest
```

#### Configuration

Create `.mcp.json` in your Go project:

```json
{
  "mcpServers": {
    "go-lsp": {
      "command": "npx",
      "args": ["-y", "@mizchi/lsmcp", "--bin", "gopls"]
    }
  }
}
```

#### Available LSP Tools

- `lsmcp_get_hover` - Get type information and documentation
- `lsmcp_find_references` - Find all references to a symbol
- `lsmcp_rename_symbol` - Rename symbols across the codebase
- `lsmcp_get_diagnostics` - Get compilation errors
- `lsmcp_get_definitions` - Go to definition
- `lsmcp_get_document_symbols` - List all symbols in a file
- `lsmcp_get_completion` - Get code completions
- `lsmcp_format_document` - Format code using gofmt
- `lsmcp_get_code_actions` - Get available code actions

### Other Languages

#### C/C++

```bash
# Install clangd
apt install clangd  # Ubuntu/Debian
brew install llvm   # macOS
```

Create `.mcp.json`:

```json
{
  "mcpServers": {
    "cpp-lsp": {
      "command": "npx",
      "args": ["-y", "@mizchi/lsmcp", "--bin", "clangd"]
    }
  }
}
```

#### Java

```bash
# Install Eclipse JDT Language Server
# See: https://github.com/eclipse/eclipse.jdt.ls

# Setup
cd my-java-project
npx -y @mizchi/lsmcp --init=claude --language=java
```

#### Moonbit

```bash
# Install Moonbit SDK (includes LSP)
# See: https://www.moonbitlang.com/download

# Setup
cd my-moonbit-project
npx -y @mizchi/lsmcp --init=claude --language=moonbit
```

## Advanced Configuration

### Custom LSP Server

```bash
# Use Deno LSP for TypeScript
npx -y @mizchi/lsmcp --bin "deno lsp"

# Use custom rust-analyzer path
npx -y @mizchi/lsmcp --bin "/path/to/rust-analyzer"
```

### Manual MCP Configuration

Edit `.mcp.json`:

```json
{
  "mcpServers": {
    "lsmcp-typescript": {
      "command": "npx",
      "args": ["-y", "@mizchi/lsmcp", "--language", "typescript"]
    },
    "lsmcp-rust": {
      "command": "npx",
      "args": ["-y", "@mizchi/lsmcp", "--language", "rust"]
    }
  }
}
```

## Supported Languages

| Language              | LSP Server                 | Installation                              |
| --------------------- | -------------------------- | ----------------------------------------- |
| TypeScript/JavaScript | Built-in + LSP             | `npm install typescript`                  |
| Rust                  | rust-analyzer              | `rustup component add rust-analyzer`      |
| Python                | pylsp                      | `pip install python-lsp-server`           |
| Go                    | gopls                      | `go install golang.org/x/tools/gopls@latest` |
| Java                  | jdtls                      | See [Eclipse JDT.LS](https://github.com/eclipse/eclipse.jdt.ls) |
| C/C++                 | clangd                     | `apt install clangd` or `brew install llvm` |
| Moonbit               | Moonbit LSP                | Included with [Moonbit SDK](https://www.moonbitlang.com/download) |
| Deno                  | deno lsp                   | `deno` command                            |

For detailed tool availability per language, see [Language Support Matrix](docs/LANGUAGE_SUPPORT_MATRIX.md).

## Develop

```bash
# Install dependencies
pnpm install

# Build
pnpm build
pnpm test

# Test locally before publishing
./dist/lsmcp.js -h

# Or use npm link for global testing
npm link
lsmcp -h
```

## Changelog

### v0.2.x
- **Breaking**: Removed automatic language detection - `--language` or `--bin` is now required
- Unified tool naming with `lsmcp_` prefix
- Added generic LSP server support
- Improved error messages and language support documentation

### v0.1.x
- Initial release with TypeScript support
- Basic LSP integration for multiple languages

## Troubleshooting

### LSP Server Not Found

If you get an error about LSP server not found:

1. Ensure the language's LSP server is installed (see Installation section above)
2. Check if it's in your PATH: `which <lsp-command>`
3. Set the LSP path explicitly in environment variables

### Language Configuration

Since v0.2.0, language must be explicitly specified:

1. Use `--language` flag: `npx -y @mizchi/lsmcp --language typescript`
2. Or use `--bin` flag: `npx -y @mizchi/lsmcp --bin "rust-analyzer"`
3. Configure in `.mcp.json` with appropriate args

### Performance Issues

- LSP servers may take time to index large projects on first run
- TypeScript projects benefit from using the native TypeScript compiler API
- Consider using language-specific servers for better performance
- Some LSP features may be limited compared to native TypeScript support

### MCP Connection Issues

If Claude can't connect to the MCP server:

1. Check that the server initialized correctly: `npx -y @mizchi/lsmcp --init=claude --language=<language>`
2. Verify `.mcp.json` exists in your project root
3. Ensure Claude Desktop has the correct permissions in `.claude/settings.json`
4. Try running the server manually to see error messages: `npx -y @mizchi/lsmcp`

## License

MIT
