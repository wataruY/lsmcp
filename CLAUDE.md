in jpn

## Features

- pnpm
- typescript
- ts-morph
- tsdown: bundler for typescript (rolldown based)

## Goal

AI に TS の操作に特化した操作を提供する

## Rules

- file は snake case
- ユニットテストは `.test.ts` で src 以下に配置
- インテグレーションテストは tests/ 以下に配置
- Deno 互換のために、 `import {} from "./x.ts";` のように拡張子を付ける

## 内部実装

最初は ts-morph を使って実現する。ts-morph だけで実装不可能な場合、 LSP や TypeScript Lauguage Service を使って実装する。

- Command: `move` のような高水準命令
- CLI: `tsrefactor move old.ts new.ts` のような CLI
- MCP: `typescript-lsp-mcp` AI 用に
