# Multi-Language MCP Support

This project now supports multiple programming languages through Language Server Protocol (LSP) integration.

## Unified LSP-MCP CLI

The new unified `lsp-mcp` command automatically detects your project language or allows you to specify one:

```bash
# Auto-detect project language
npx lsp-mcp

# Specify language explicitly
npx lsp-mcp --language rust
npx lsp-mcp -l typescript

# Initialize for Claude
npx lsp-mcp --init claude
npx lsp-mcp -l moonbit --init claude

# List supported languages
npx lsp-mcp --list

# Show help
npx lsp-mcp --help
```

## Supported Languages

- **TypeScript/JavaScript** - Full semantic refactoring support via TypeScript Compiler API
- **Moonbit** - LSP-based support for the Moonbit programming language
- **Rust** - LSP-based support via rust-analyzer
- **Python** - LSP-based support via pylsp
- **Go** - LSP-based support via gopls
- **Java** - LSP-based support via jdtls
- **C/C++** - LSP-based support via clangd

## Available MCP Servers

### 1. typescript-mcp
Specialized TypeScript/JavaScript support with advanced refactoring capabilities.

```bash
npx typescript-mcp --init=claude
```

### 2. moonbit-mcp
Moonbit language support.

```bash
# Install moon first: https://www.moonbitlang.com/download
npx moonbit-mcp --init=claude
```

### 3. rust-mcp
Rust language support.

```bash
# Install rust-analyzer first
rustup component add rust-analyzer
npx rust-mcp --init=claude
```

### 4. multi-language-mcp
Auto-detects project language and starts appropriate LSP server.

```bash
npx multi-language-mcp --init=claude
```

### 5. generic-lsp-mcp
Generic LSP server for any language (requires manual LSP_COMMAND configuration).

```bash
npx generic-lsp-mcp --init=claude
# Then set LSP_COMMAND in .mcp.json
```

## Language-Specific Tools

Each language server provides tools prefixed with the language name:

### TypeScript/JavaScript
- `mcp__typescript__rename_symbol`
- `mcp__typescript__move_file`
- `mcp__typescript__get_type_at_symbol`
- etc.

### Moonbit
- `moonbit_get_hover`
- `moonbit_find_references`
- `moonbit_rename_symbol`
- etc.

### Rust
- `rust_get_hover`
- `rust_find_references`
- `rust_rename_symbol`
- etc.

## Configuration

### Auto-detection (multi-language-mcp)
The multi-language server automatically detects your project type based on:
- Configuration files (Cargo.toml, moon.mod.json, tsconfig.json, etc.)
- File extensions in the project root

### Manual Language Selection
Set `FORCE_LANGUAGE` environment variable to override auto-detection:

```json
{
  "mcpServers": {
    "lsp": {
      "command": "npx",
      "args": ["multi-language-mcp"],
      "env": {
        "FORCE_LANGUAGE": "rust"
      }
    }
  }
}
```

## Installation Requirements

### Moonbit
```bash
# Install moon from https://www.moonbitlang.com/download
# The LSP server is included with moon installation
```

### Rust
```bash
rustup component add rust-analyzer
```

### Python
```bash
pip install python-lsp-server
```

### Go
```bash
go install golang.org/x/tools/gopls@latest
```

### C/C++
```bash
# Ubuntu/Debian
sudo apt-get install clangd

# macOS
brew install llvm
```

## Example Usage

### Moonbit Project
```bash
cd my-moonbit-project
npx moonbit-mcp --init=claude
claude
```

Then in Claude:
```
Use moonbit_get_hover to show type information for the `hello` function in src/lib/hello.mbt
```

### Rust Project
```bash
cd my-rust-project
npx rust-mcp --init=claude
claude
```

Then in Claude:
```
Use rust_find_references to find all uses of the `Config` struct
```

### Auto-Detection
```bash
cd my-project  # Can be any supported language
npx multi-language-mcp --init=claude
claude
```

## Troubleshooting

### LSP Server Not Found
If you get an error about LSP server not found:
1. Ensure the language's LSP server is installed (see Installation Requirements)
2. Check if it's in your PATH
3. Set the LSP path explicitly in environment variables

### Language Not Detected
If auto-detection fails:
1. Ensure your project has appropriate config files
2. Use `FORCE_LANGUAGE` to manually specify the language
3. Use the language-specific MCP server instead of multi-language

### Performance Issues
- LSP servers may take time to index large projects on first run
- Consider using language-specific servers instead of multi-language for better performance
- Some LSP features may be limited compared to native TypeScript support