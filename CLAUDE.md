in jpn

## Features

- pnpm
- typescript
- ts-morph

## Goal

AI に TS に特化したリファクタツールを与える。

## Rules

- file は snake case

## 内部実装

最初は ts-morph を使って実現する。ts-morph だけで実装不可能な場合、 LSP や TypeScript Lauguage Service を使って実装する。

- Command: `move` のような高水準命令
- CLI: `tsrefactor move old.ts new.ts` のような CLI
- MCP: `typescript-lsp-mcp` AI 用に
