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
      "args": ["-y", "@mizchi/lsmcp"]
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
      "args": ["-y", "@mizchi/lsmcp"]
    },
    // Or use specific language
    "rust": {
      "command": "npx",
      "args": ["-y", "@mizchi/lsmcp", "--language", "rust"]
    },
    // Or use custom LSP
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
npx -y @mizchi/lsmcp                    # Auto-detects TypeScript projects
# or explicitly:
npx -y @mizchi/lsmcp --language typescript
```

All TypeScript-specific features remain available through `lsmcp`. The tool will automatically detect TypeScript projects by looking for `tsconfig.json` or `package.json` files.

## Using lsmcp - Unified Language Server MCP

`lsmcp` is a unified CLI that supports multiple language servers through the `--language` flag or automatic detection.

### Basic Usage

```bash
# Auto-detect project language
npx -y @mizchi/lsmcp

# Specify language explicitly
npx -y @mizchi/lsmcp --language typescript
npx -y @mizchi/lsmcp -l rust
npx -y @mizchi/lsmcp -l moonbit

# Use custom LSP server
npx -y @mizchi/lsmcp --bin "deno lsp"
npx -y @mizchi/lsmcp --bin "rust-analyzer"

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

#### Quick Setup

```bash
cd my-rust-project
npx -y @mizchi/lsmcp --init=claude --language=rust
claude
```

#### Available Tools

- `rust_get_hover` - Get type information and documentation
- `rust_find_references` - Find all references to a symbol
- `rust_rename_symbol` - Rename symbols across the codebase
- `rust_get_diagnostics` - Get compilation errors and warnings

#### Example Usage in Claude

```
Use rust_rename_symbol to rename the struct "Config" to "AppConfig"
Use rust_find_references to find all uses of the "parse_args" function
```

### Python

#### Prerequisites

```bash
# Install Python LSP server
pip install python-lsp-server
```

#### Quick Setup

```bash
cd my-python-project
npx -y @mizchi/lsmcp --init=claude --language=python
claude
```

#### Available Tools

- `python_get_hover` - Get documentation and type information
- `python_find_references` - Find all references to a symbol
- `python_rename_symbol` - Rename symbols across the codebase
- `python_get_diagnostics` - Get syntax and type errors

#### Example Usage in Claude

```
Use python_get_hover to show documentation for the "process_data" function
Use python_rename_symbol to rename the class "DataProcessor" to "DataHandler"
```

### Go

#### Prerequisites

```bash
# Install gopls
go install golang.org/x/tools/gopls@latest
```

#### Quick Setup

```bash
cd my-go-project
npx -y @mizchi/lsmcp --init=claude --language=go
claude
```

#### Available Tools

- `go_get_hover` - Get type information and documentation
- `go_find_references` - Find all references to a symbol
- `go_rename_symbol` - Rename symbols across the codebase
- `go_get_diagnostics` - Get compilation errors

### Other Languages

#### C/C++

```bash
# Install clangd
apt install clangd  # Ubuntu/Debian
brew install llvm   # macOS

# Setup
cd my-cpp-project
npx -y @mizchi/lsmcp --init=claude --language=cpp
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
