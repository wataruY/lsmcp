# Migration Guide

## From v0.1.x to v0.2.x

### Breaking Changes

#### 1. Language Auto-detection Removed

**Before (v0.1.x):**
```bash
npx @mizchi/lsmcp  # Would auto-detect TypeScript projects
```

**After (v0.2.x):**
```bash
# Must explicitly specify language or LSP binary
npx -y @mizchi/lsmcp --language typescript
# or
npx -y @mizchi/lsmcp --bin "typescript-language-server --stdio"
```

#### 2. Tool Name Changes

All LSP tools now use the `lsmcp_` prefix for consistency:

**Before:**
- `lsp_get_hover`
- `lsp_find_references`
- `lsp_rename_symbol`

**After:**
- `lsmcp_get_hover`
- `lsmcp_find_references`
- `lsmcp_rename_symbol`

#### 3. Simplified Architecture

The following standalone MCP servers have been removed:
- `rust-mcp`
- `python-mcp`
- `go-mcp`
- `java-mcp`
- `moonbit-mcp`

Use `lsmcp --bin` instead:
```bash
# Rust
npx -y @mizchi/lsmcp --bin "rust-analyzer"

# Python
npx -y @mizchi/lsmcp --bin "pylsp"

# Go
npx -y @mizchi/lsmcp --bin "gopls"
```

### New Features

#### 1. Generic LSP Server Support

You can now use any LSP server via the `--bin` option:
```bash
npx -y @mizchi/lsmcp --bin "your-lsp-server --stdio"
```

#### 2. Improved TypeScript Support

- TypeScript now uses Compiler API by default for better performance
- Use `FORCE_LSP=true` to use LSP mode instead
- New TypeScript-specific tools available

#### 3. Better Error Messages

- Clear indication when using language-specific tools with wrong language
- Suggestions for available tools per language

### Migration Steps

1. **Update `.mcp.json`:**
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

2. **Update `.claude/settings.json`:**
   ```json
   {
     "permissions": {
       "allow": [
         "mcp__lsmcp__lsmcp_*",
         "mcp__typescript__lsmcp_*"
       ]
     }
   }
   ```

3. **Update tool usage in prompts:**
   - Replace `lsp_` prefix with `lsmcp_`
   - Be aware of TypeScript-specific vs LSP-common tools

## From typescript-mcp to lsmcp

The standalone `typescript-mcp` command has been integrated into `lsmcp`:

**Before:**
```bash
npx typescript-mcp
```

**After:**
```bash
npx -y @mizchi/lsmcp --language typescript
```

All features remain the same, with additional multi-language support.