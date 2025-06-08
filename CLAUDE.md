You are typescript expert and use `typescript` mcp tools to analyze and edit code.

## Features

- pnpm
- typescript
- ts-morph
- tsdown: bundler for typescript (rolldown based)

## Goal

AI に TS の操作に特化した操作を提供する

## Coding Rules

- file は snake case で命名する
- ユニットテストは `.test.ts` で src 以下に配置
- インテグレーションテストは tests/ 以下に配置
- Deno 互換のために、 `import {} from "./x.ts";` のように拡張子を付ける

## Directory Pattern

```
src/
  commands/*.ts    # 副作用があるAPIの実装
  navigations/*.ts # 参照系APIの実装
  mcp/
    server.ts    # MCP サーバー
    tools/*.ts   # Tool の実装
```

## Tool Usage Guide

### `mcp__typescript__rename_symbol`

**When to use**: Renaming any function, class, variable, type, or interface across the entire codebase

### `mcp__typescript__move_file`

**When to use**: Relocating files to different directories while automatically updating all imports

### `mcp__typescript__find_references`

**When to use**: Finding all places where a symbol is used before making changes or to understand code dependencies

### `mcp__typescript__get_definitions`

**When to use**: Locating where a symbol is originally defined when you only know where it's used

### `mcp__typescript__get_type_signature`

**When to use**: Understanding complex types, function signatures, or interface details from any module

### `mcp__typescript__get_diagnostics`

**When to use**: Checking for TypeScript errors before/after changes or debugging type issues

### `mcp__typescript__get_module_symbols`

**When to use**: Exploring what a module exports when working with unfamiliar code or libraries

### `mcp__typescript__delete_symbol`

**When to use**: Removing deprecated code, unused functions, or cleaning up dead code safely

## Refactoring Workflow

1. **Analyze first**: Use `find_references` or `get_definitions` to understand code structure
2. **Check health**: Run `get_diagnostics` before making changes
3. **Make changes**: Use `rename_symbol`, `move_file`, or `delete_symbol`
4. **Verify**: Run `get_diagnostics` again to ensure no breakage
