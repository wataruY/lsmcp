# MCP Server Usage Guide

## 🎯 Quick Start

### 1. Install Dependencies
```bash
# Install TypeScript (required for TypeScript tools)
npm install -g typescript

# Install TypeScript Language Server (required for LSP tools)
npm install -g typescript-language-server

# Build the MCP servers
pnpm build
```

### 2. Available MCP Servers

#### TypeScript MCP Server
- **Command**: `dist/typescript-mcp.js`
- **Features**: Direct TypeScript Compiler API access
- **Advantages**: Fast, no external process needed
- **Best for**: Refactoring, type analysis, symbol navigation

#### LSP MCP Server  
- **Command**: `dist/generic-lsp-mcp.js`
- **Features**: Full Language Server Protocol support
- **Advantages**: IDE-like features (completions, formatting)
- **Best for**: Code completion, diagnostics, formatting

## 📋 New Features

### 1. List Available Tools
```typescript
// Use this tool first to see what's available
tool: list_tools
arguments:
  category: "all" // or "typescript" or "lsp"
```

### 2. Better Error Messages
All tools now provide:
- Clear error descriptions
- Helpful suggestions to fix issues
- Alternative tools you can try

### 3. Improved Interface
- Consistent parameter naming across tools
- Use `line` + `target` instead of line/character positions
- Clear indication of required vs optional parameters

## 🔧 Common Usage Patterns

### Pattern 1: Get Type Information
```typescript
// Option 1: TypeScript tool (fast)
tool: get_type_at_symbol
arguments:
  root: "/path/to/project"
  filePath: "src/utils.ts"
  line: 10
  symbolName: "myFunction"

// Option 2: LSP tool (more detailed)
tool: lsp_get_hover
arguments:
  root: "/path/to/project"
  filePath: "src/utils.ts"
  line: 10
  target: "myFunction"
```

### Pattern 2: Find References
```typescript
// Option 1: TypeScript tool
tool: find_references
arguments:
  root: "/path/to/project"
  filePath: "src/index.ts"
  line: 5
  symbolName: "Config"

// Option 2: LSP tool
tool: lsp_find_references
arguments:
  root: "/path/to/project"
  filePath: "src/index.ts"
  line: 5
  symbolName: "Config"
```

### Pattern 3: Get Code Completions
```typescript
// LSP tool only
tool: lsp_get_completion
arguments:
  root: "/path/to/project"
  filePath: "src/app.ts"
  line: 25
  target: "console." // Get completions after "console."
```

## 🚨 Troubleshooting

### LSP Tools Not Working?
1. Check if typescript-language-server is installed:
   ```bash
   which typescript-language-server
   ```

2. If not installed:
   ```bash
   npm install -g typescript-language-server
   ```

3. Use TypeScript tools as alternatives (they don't need LSP)

### Response Too Large?
- Use more specific queries
- Target specific directories instead of entire project
- Use filters when available

### Can't Find a Symbol?
- Check spelling and case sensitivity
- Try using string search instead of line numbers
- Use `find_references` to search across files

## 💡 Tips

1. **Start with `list_tools`** to see all available tools
2. **Try TypeScript tools first** - they're faster and don't need setup
3. **Use LSP tools for IDE features** like completions and formatting
4. **Check error suggestions** - they often have the solution
5. **Use relative paths** from the project root

## 📝 Examples

### Example 1: Rename a Variable
```typescript
tool: rename_symbol
arguments:
  root: "/home/user/project"
  filePath: "src/config.ts"
  line: "const API_KEY"
  oldName: "API_KEY"
  newName: "API_SECRET"
```

### Example 2: Get All Exports from a Module
```typescript
tool: get_module_symbols
arguments:
  root: "/home/user/project"
  moduleName: "./src/utils/helpers.ts"
```

### Example 3: Format a File
```typescript
tool: lsp_format_document
arguments:
  root: "/home/user/project"
  filePath: "src/messy-code.ts"
  applyChanges: true
```

## 🎉 Summary

The improved MCP servers now offer:
- ✅ Better discoverability with `list_tools`
- ✅ Clearer error messages with suggestions
- ✅ Consistent interface across all tools
- ✅ Documentation and examples built-in
- ✅ Choice between fast TypeScript tools and feature-rich LSP tools

Happy coding! 🚀