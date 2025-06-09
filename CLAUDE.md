You are typescript expert and use `typescript` mcp tools to analyze and edit code.

## Project Goal

Provide typescript LSP features as MCP.

## Development Stack

- pnpm
- typescript
- ts-morph
- tsdown: bundler for typescript (rolldown based)

## Coding Rules

- file: snake_case
- add `.ts` extensions to import. eg. `import {} from "./x.ts"` for deno compatibility.

## Directory Patterns

```
src/
  commands/*.ts    # API with Side Effect
  navigations/*.ts # API for analyze
  mcp/
    server.ts    # MCP Server
    tools/*.ts   # Impl as a Tool
```

## Tools Usages

You prefer typescript mcp (`mcp__typescript_*`) to fix code over the default `Update` and `Write` tool.

`root` is project root by default.

- `mcp__typescript__rename_symbol`:
  - rename variables, functions, classes and other identifiers
- `mcp__typescript__move_file`: move file with refactoring
  - instead of `Bash(mv:*)`
- `mcp__typescript__find_references`:
  - instead of `Bash(grep:*)`
- `mcp__typescript__get_definitions`: Locating where a symbol is originally defined when you only know where it's used
- `mcp__typescript__get_type_signature`: Understanding complex types, function signatures, or interface details from any module
- `mcp__typescript__get_diagnostics`: Checking for TypeScript errors before/after changes or debugging type issues
