in jpn

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

## 内部実装

ts-morph を使って実現する。ts-morph だけで実装不可能な場合、 LSP や TypeScript Lauguage Service を使って実装する。

```
src/
  commands/*.ts    # 副作用があるAPIの実装
  navigations/*.ts # 参照系APIの実装
  mcp/
    server.ts    # MCP サーバー
    tools/*.ts   # Tool の実装
```
