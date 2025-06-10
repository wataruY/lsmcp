# typescript-mcp で AI に LSP のリファクタリング機能を与える

`npx -y typescript-mcp@latest` で動く。

主語大きめだけど、 npm の名前空間が空いてたので...

GitHub: [typescript-mcp](https://github.com/your-repo/typescript-mcp)

> ⚠️ **API や機能は予告なく変更される可能性があります。**

## TL;DR

- 既存のエージェントの内蔵ツールはセマンティックな AST 操作ができない
  - 書き換えてみて駄目だったら修正、みたいな挙動
- MCP サーバーとして、 Rename, Move File, Go to Definition, Find References 等の LSP の機能を提供した

実際に動いている例

```
# Rename file
● typescript:move_file (MCP)(root: "~/s
                            andbox/claude-mcp",
                            oldPath: "examples/oth
                            er-types.ts", newPath:
                             "examples/types.ts")
  ⎿ Successfully moved file from "~/san
    dbox/claude-mcp/examples/other-types.ts" to
    "~/sandbox/claude-mcp/examples/type
    s.ts". Updated imports in 2 file(s).

    Changes:
      File moved: examples/other-types.ts →
    examples/types.ts
```

## Install

今現在は claude-code mcp サーバーとして動く。

```bash
# TypeScript プロジェクトを設定
$ npm install typescript typescript-mcp -D
$ npx tsc --init

# 初期化コマンド
$ npx typescript-mcp@latest --init=claude
# .claude/mcp_servers.json MCP 設定を生成
# .claude/settings.json に MCP 設定を生成
## CLAUDE.md 用の追加プロンプト
# You prefer typescript mcp (`mcp__typescript_*`) to fix code over the default `Update` and `Write` tool.

# MCP サーバーと一緒に起動
$ claude

# /mcp で起動してるかわかる
╭─────────────────────────────────────────────────────╮
│ Manage MCP Servers                                  │
│ 1 servers found                                     │
│                                                     │
│   typescript · connected                            │
╰─────────────────────────────────────────────────────╯
```

カレントディレクトリの TypeScript LSP を掴むはず。

## 実装したモチベーション

今はまだ言語特化プロンプトが必要

https://tskaigi.mizchi.workers.dev/

なんなら MCP Agent として実装するのがいいはず。した。

既存のエージェントの内蔵ツールは、セマンティックな AST 操作ができない
書き換えてみて駄目だったら修正、みたいな挙動をする。typescript-mcp があれば安全にリネームできる。

`Go to Definitions` 定義元にジャンプするので、node_modules 内の型定義ファイルを自分で参照できるようになる。

## 工夫: 実質 LSP の MCP だが...

最初は LSP をそのまま喋らせようとしたが、LLM は内部トークンのせいでワードカウントが下手という問題がある。

line:column ベースでカーソル位置の操作をさせようとすると、そのままできない。当てずっぽうで外す。

line は ClaudeCode や Roo はエージェント内部で diff を作るために保持しているので、何行目のこのシンボル、という風に API を調整してある。

```ts
const schema = z.object({
  root: z.string().describe("Root directory for resolving relative paths"),
  filePath: z
    .string()
    .describe("File path containing the symbol (relative to root)"),
  line: z
    .union([z.number(), z.string()])
    .describe("Line number (1-based) or string to match in the line"),
  oldName: z.string().describe("Current name of the symbol"),
  newName: z.string().describe("New name for the symbol"),
});
```

## 主な機能

`mcp__typescript__` は claude code 側で生成される名前空間

### 1. セマンティックなファイル操作

- **ファイル移動** (`mcp__typescript__move_file`) - インポート文を自動更新
- **ディレクトリ移動** (`mcp__typescript__move_directory`) - ディレクトリ全体を移動し、すべてのインポートを更新

### 2. シンボル操作

- **シンボルのリネーム** (`mcp__typescript__rename_symbol`) - プロジェクト全体でシンボルをリネーム
- **シンボルの削除** (`mcp__typescript__delete_symbol`) - シンボルとその参照をすべて削除
- **参照の検索** (`mcp__typescript__find_references`) - シンボルへのすべての参照を検索

### 3. コード分析

- **定義の取得** (`mcp__typescript__get_definitions`) - シンボルの定義位置を取得
- **診断情報** (`mcp__typescript__get_diagnostics`) - TypeScript のエラーや警告を取得
- **モジュールシンボル** (`mcp__typescript__get_module_symbols`) - モジュールのエクスポートを一覧表示
- **型情報の取得** (`mcp__typescript__get_type_in_module`, `mcp__typescript__get_type_at_symbol`) - 詳細な型シグネチャを取得

## 使用例

````bash
# rename
> examples/scratch.ts foo to bar
Successfully renamed symbol "foo" to "bar" in 1 file(s) with 2 change(s).

# move file
> move examples/other-types.ts to examples/types.ts
Successfully moved file from "examples/other-types.ts" to "examples/types.ts"
Updated imports in 2 file(s).

# get definitions
```bash
> get toMcpHandler definitions
Found 1 definition for symbol "toMcpToolHandler"
  src/mcp/mcp_server_utils.ts:15:1 - export function toMcpToolHandler<T>(
````

## 課題

- プロンプトに工夫が必要
  - 機能として存在していても、Roo や Claude Code は内部ツールを使おうとするバイアスが強いので、`typescript-mcp` を優先的に使わせるのが難しい
  - 現状これ: `You prefer typescript mcp (mcp__typescript_*) to fix code over the default Update and Write tool.`
  - 専用ワークフロー定義が必要かも
- claude code 以外でまだデバッグしてない
- LSP MCP として実装すれば TS 以外も対応可能だったが、一旦 ts-morph で楽した
