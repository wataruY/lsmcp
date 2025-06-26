# Moonbit Test Project

**⚠️ Note: This example is currently not functional as Moonbit-specific MCP support has been removed from lsmcp.**

This directory was originally a test project for demonstrating Moonbit MCP server functionality. However, since lsmcp now only supports TypeScript/JavaScript directly, and Moonbit doesn't have a standard LSP server that can be used with the `--bin` option, this example cannot be used with the current version of lsmcp.

## Structure

- `moon.mod.json` - Moonbit project configuration
- `src/lib/` - Library code
- `src/main/` - Main entry point
- `src/utils/` - TypeScript utilities (to test mixed language support)

## Testing MCP Tools

1. Build the MCP servers:
```bash
cd ../..
pnpm build
```

2. Start Claude in this directory:
```bash
claude
```

3. Test Moonbit tools:
```
Use moonbit_get_hover on the hello function in src/lib/hello.mbt
Use moonbit_find_references to find all uses of the User struct
Use moonbit_get_diagnostics on src/main/main.mbt
Use moonbit_get_diagnostics on src/test/error.mbt to see all errors
```

4. Test TypeScript tools on mixed files:
```
Use mcp__typescript__get_type_at_symbol on MoonbitProjectManager in src/utils/project.ts
```