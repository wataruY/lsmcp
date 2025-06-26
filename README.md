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

**When performing refactoring operations on code, ALWAYS use MCP tools instead of the default Edit/Write tools.**

For TypeScript/JavaScript projects:
- For renaming symbols: ALWAYS use `mcp__lsmcp__rename_symbol` instead of Edit/Write
- For moving files: ALWAYS use `mcp__lsmcp__move_file` instead of Bash(mv)
- For finding references: ALWAYS use `mcp__lsmcp__find_references` instead of Grep
- For type analysis: ALWAYS use `mcp__lsmcp__get_type_*` tools

For other languages (using LSP):
- For renaming symbols: ALWAYS use `lsp_rename_symbol` instead of Edit/Write
- For finding references: ALWAYS use `lsp_find_references` instead of Grep
- For diagnostics: ALWAYS use `lsp_get_diagnostics`

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
npx -y @mizchi/lsmcp                    # Auto-detects TypeScript projects
# or explicitly:
npx -y @mizchi/lsmcp --language typescript
```

All TypeScript-specific features remain available through `lsmcp`. The tool will automatically detect TypeScript projects by looking for `tsconfig.json` or `package.json` files.

## Using lsmcp - Unified Language Server MCP

`lsmcp` is a unified CLI that supports multiple language servers through the `--language` flag or automatic detection.

### Basic Usage

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

# Initialize for Claude (requires --language)
npx -y @mizchi/lsmcp --init claude --language typescript

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

### Custom LSP Server Examples

```bash
# Use Deno LSP for TypeScript
npx -y @mizchi/lsmcp --bin "deno lsp"

# Use TypeScript Native Preview (TSGO) for faster performance
npm install @typescript/native-preview
npx -y @mizchi/lsmcp --bin "tsgo --lsp --stdio"

# Use custom rust-analyzer path
npx -y @mizchi/lsmcp --bin "rust-analyzer"

# Use TypeScript LSP with custom tsserver path
npx -y @mizchi/lsmcp --bin "typescript-language-server --stdio --tsserver-path=/usr/local/lib/node_modules/typescript/lib"
```

### Experimental TSGO

For faster TypeScript performance, you can use TypeScript Native Preview:

```bash
npm install @typescript/native-preview
```

Then use it with lsmcp:

```bash
npx -y @mizchi/lsmcp --bin "npx @typescript/native-preview -- --lsp --stdio"
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
      "args": ["-y", "@mizchi/lsmcp"]
    }
  }
}
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

- `mcp__lsmcp__rename_symbol` - Rename symbols across the codebase
- `mcp__lsmcp__move_file` - Move files and update imports
- `mcp__lsmcp__find_references` - Find all references to a symbol
- `mcp__lsmcp__get_diagnostics` - Get errors and warnings
- `mcp__lsmcp__get_type_at_symbol` - Get type information

#### Example Usage in Claude

```
Use mcp__lsmcp__rename_symbol to rename the function "calculateTotal" to "computeSum" in src/utils.ts
Use mcp__lsmcp__find_references to find all uses of the "User" interface
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

- `lsp_get_hover` - Get type information and documentation
- `lsp_find_references` - Find all references to a symbol
- `lsp_rename_symbol` - Rename symbols across the codebase
- `lsp_get_diagnostics` - Get compilation errors and warnings
- `lsp_get_definitions` - Go to definition
- `lsp_get_document_symbols` - List all symbols in a file
- `lsp_get_completion` - Get code completions
- `lsp_format_document` - Format code using rustfmt
- `lsp_get_code_actions` - Get available code actions

#### Example Usage in Claude

```
Use lsp_rename_symbol to rename the struct "Config" to "AppConfig"
Use lsp_find_references to find all uses of the "parse_args" function
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

- `lsp_get_hover` - Get documentation and type information
- `lsp_find_references` - Find all references to a symbol
- `lsp_rename_symbol` - Rename symbols across the codebase
- `lsp_get_diagnostics` - Get syntax and type errors
- `lsp_get_definitions` - Go to definition
- `lsp_get_document_symbols` - List all symbols in a file
- `lsp_get_completion` - Get code completions
- `lsp_format_document` - Format code
- `lsp_get_code_actions` - Get available code actions

#### Example Usage in Claude

```
Use lsp_get_hover to show documentation for the "process_data" function
Use lsp_rename_symbol to rename the class "DataProcessor" to "DataHandler"
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

- `lsp_get_hover` - Get type information and documentation
- `lsp_find_references` - Find all references to a symbol
- `lsp_rename_symbol` - Rename symbols across the codebase
- `lsp_get_diagnostics` - Get compilation errors
- `lsp_get_definitions` - Go to definition
- `lsp_get_document_symbols` - List all symbols in a file
- `lsp_get_completion` - Get code completions
- `lsp_format_document` - Format code using gofmt
- `lsp_get_code_actions` - Get available code actions

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

| Language              | Detection Files                                  | LSP Server                 |
| --------------------- | ------------------------------------------------ | -------------------------- |
| TypeScript/JavaScript | `tsconfig.json`, `package.json`                  | typescript-language-server |
| Rust                  | `Cargo.toml`                                     | rust-analyzer              |
| Python                | `pyproject.toml`, `setup.py`, `requirements.txt` | pylsp                      |
| Go                    | `go.mod`                                         | gopls                      |
| Java                  | `pom.xml`, `build.gradle`                        | jdtls                      |
| C/C++                 | `CMakeLists.txt`, `Makefile`                     | clangd                     |
| Moonbit               | `moon.mod.json`                                  | Moonbit LSP                |

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
2. Use `--language` flag to explicitly specify: `npx -y @mizchi/lsmcp -l python`
3. Set `FORCE_LANGUAGE` environment variable in your MCP configuration

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
