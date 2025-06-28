# DAP MCP Server 使用ガイド

DAP (Debug Adapter Protocol) MCP サーバーは、Model Context Protocol を通じてデバッグ機能を提供し、AIアシスタントがプログラムを対話的にデバッグできるようにします。

## 目次

1. [インストールと設定](#インストールと設定)
2. [基本概念](#基本概念)
3. [利用可能なツール](#利用可能なツール)
4. [実践的な使用例](#実践的な使用例)
5. [サポートされているデバッグアダプター](#サポートされているデバッグアダプター)
6. [トラブルシューティング](#トラブルシューティング)
7. [内部動作の仕組み](#内部動作の仕組み)

## インストールと設定

### インストール

```bash
# グローバルインストール
npm install -g @mizchi/lsmcp

# または npx で使用
npx @mizchi/lsmcp-dap
```

### MCP設定

Claude の設定ファイル `.mcp.json` に追加：

```json
{
  "mcpServers": {
    "dap-dev": {
      "command": "node",
      "args": ["dist/dap-mcp.js"]
    }
  }
}
```

## 基本概念

### セッション管理

- 各デバッグセッションは一意の `sessionId` で識別される
- 複数のセッションを同時に実行可能
- セッションごとに独立したデバッグアダプタープロセスが起動

### ファイルパス

- すべてのファイルパスは**絶対パス**で指定する必要がある
- 相対パスはサポートされていない

### 非同期操作

- すべてのデバッグ操作は非同期（Promise ベース）
- タイムアウトは通常10秒

## 利用可能なツール

### セッション管理

#### `debug_launch` - デバッグセッションの開始

新しいプログラムのデバッグセッションを開始します。

```typescript
mcp__dap-dev__debug_launch({
  sessionId: "my-debug-session",      // 一意のセッションID（任意の文字列）
  adapter: "node",                    // デバッグアダプター
  program: "/absolute/path/to/file.js", // デバッグ対象ファイル（絶対パス）
  stopOnEntry: true,                  // 最初の行で停止するか
  cwd: "/working/directory",          // 作業ディレクトリ（オプション）
  args: ["arg1", "arg2"],            // プログラム引数（オプション）
  env: { NODE_ENV: "development" }    // 環境変数（オプション）
})
```

**パラメータ:**
- `sessionId` (必須): セッションの一意識別子
- `adapter` (必須): 使用するデバッグアダプター
- `program` (必須): デバッグ対象プログラムのパス
- `stopOnEntry`: プログラム開始時に停止するか（デフォルト: false）
- `cwd`: 作業ディレクトリ
- `args`: プログラムに渡す引数の配列
- `env`: 環境変数のオブジェクト

#### `debug_attach` - 実行中のプロセスにアタッチ

既に実行中のプロセスにデバッガーをアタッチします。

```typescript
mcp__dap-dev__debug_attach({
  sessionId: "attach-session",
  adapter: "node",
  port: 9229,
  host: "localhost"
})
```

#### `debug_list_sessions` - アクティブセッション一覧

現在アクティブなすべてのデバッグセッションを表示します。

```typescript
mcp__dap-dev__debug_list_sessions()
// 戻り値: ["session1", "session2", ...]
```

#### `debug_disconnect` - セッションの終了

デバッグセッションを終了します。

```typescript
mcp__dap-dev__debug_disconnect({
  sessionId: "my-debug-session",
  terminateDebuggee: true  // デバッグ対象プロセスも終了するか
})
```

### ブレークポイント管理

#### `debug_set_breakpoints` - ブレークポイントの設定

ソースファイルの特定の行にブレークポイントを設定します。

```typescript
mcp__dap-dev__debug_set_breakpoints({
  sessionId: "my-debug-session",
  source: "/absolute/path/to/file.js",
  lines: [5, 10, 15],                   // ブレークポイントを設定する行番号
  conditions: ["x > 10", "", "y < 0"]  // 条件付きブレークポイント（オプション）
})
```

### 実行制御

#### `debug_continue` - 実行を継続

プログラムの実行を次のブレークポイントまで継続します。

```typescript
mcp__dap-dev__debug_continue({
  sessionId: "my-debug-session",
  threadId: 1  // スレッドID（オプション、デフォルトは現在のスレッド）
})
```

#### `debug_step_over` - ステップオーバー

現在の行を実行し、次の行で停止します（関数呼び出しには入りません）。

```typescript
mcp__dap-dev__debug_step_over({
  sessionId: "my-debug-session"
})
```

#### `debug_step_into` - ステップイン

関数呼び出しの中に入ります。

```typescript
mcp__dap-dev__debug_step_into({
  sessionId: "my-debug-session"
})
```

#### `debug_step_out` - ステップアウト

現在の関数から抜けて、呼び出し元に戻ります。

```typescript
mcp__dap-dev__debug_step_out({
  sessionId: "my-debug-session"
})
```

#### `debug_pause` - 実行を一時停止

実行中のプログラムを一時停止します。

```typescript
mcp__dap-dev__debug_pause({
  sessionId: "my-debug-session"
})
```

### 状態確認

#### `debug_get_stack_trace` - スタックトレースの取得

現在の呼び出しスタックを取得します。

```typescript
mcp__dap-dev__debug_get_stack_trace({
  sessionId: "my-debug-session"
})
// 戻り値: "#0 functionName at file.js:10:5\n#1 main at file.js:20:3"
```

#### `debug_get_variables` - 変数の取得

現在のスコープ内の変数を取得します。

```typescript
// すべてのスコープを取得
mcp__dap-dev__debug_get_variables({
  sessionId: "my-debug-session"
})

// 特定のスコープを指定
mcp__dap-dev__debug_get_variables({
  sessionId: "my-debug-session",
  scopeName: "Local",     // "Local", "Global", "Closure" など
  frameId: 0             // スタックフレームID（オプション）
})
```

#### `debug_evaluate` - 式の評価

デバッグコンテキストで式を評価します。

```typescript
mcp__dap-dev__debug_evaluate({
  sessionId: "my-debug-session",
  expression: "x + y * 2",        // 評価する式
  context: "repl",                // "watch", "repl", "hover" のいずれか
  frameId: 0                      // スタックフレームID（オプション）
})
```

## 実践的な使用例

### 例1: 基本的なデバッグフロー

```javascript
// 1. デバッグ対象のコードを用意
const testCode = `
function calculateSum(numbers) {
    let total = 0;
    for (let i = 0; i < numbers.length; i++) {
        total += numbers[i];
    }
    return total;
}

const data = [1, 2, 3, 4, 5];
const result = calculateSum(data);
console.log('Sum:', result);
`;

// 2. デバッグセッションを開始
mcp__dap-dev__debug_launch({
  sessionId: "sum-debug",
  adapter: "node",
  program: "/path/to/calculate.js",
  stopOnEntry: false
})

// 3. ループ内にブレークポイントを設定
mcp__dap-dev__debug_set_breakpoints({
  sessionId: "sum-debug",
  source: "/path/to/calculate.js",
  lines: [5]  // total += numbers[i] の行
})

// 4. 実行を開始
mcp__dap-dev__debug_continue({ sessionId: "sum-debug" })

// 5. ブレークポイントで停止したら状態を確認
mcp__dap-dev__debug_get_stack_trace({ sessionId: "sum-debug" })

// 6. ローカル変数を確認
mcp__dap-dev__debug_get_variables({
  sessionId: "sum-debug",
  scopeName: "Local"
})

// 7. 現在の合計値を評価
mcp__dap-dev__debug_evaluate({
  sessionId: "sum-debug",
  expression: "total",
  context: "repl"
})

// 8. ステップ実行で動作を確認
mcp__dap-dev__debug_step_over({ sessionId: "sum-debug" })

// 9. 実行を継続
mcp__dap-dev__debug_continue({ sessionId: "sum-debug" })

// 10. セッションを終了
mcp__dap-dev__debug_disconnect({
  sessionId: "sum-debug",
  terminateDebuggee: true
})
```

### 例2: エラーのデバッグ

```javascript
// エラーが発生するコードをデバッグ
const buggyCode = `
function processData(items) {
    const results = [];
    for (let i = 0; i <= items.length; i++) {  // バグ: <= で範囲外アクセス
        results.push(items[i].toUpperCase());
    }
    return results;
}

try {
    const data = ['hello', 'world'];
    const processed = processData(data);
    console.log(processed);
} catch (error) {
    console.error('Error:', error.message);
}
`;

// 条件付きブレークポイントでエラー発生箇所を特定
mcp__dap-dev__debug_set_breakpoints({
  sessionId: "error-debug",
  source: "/path/to/buggy.js",
  lines: [5],
  conditions: ["i === items.length"]  // 配列境界でのみ停止
})
```

### 例3: 非同期コードのデバッグ

```javascript
// 非同期処理のデバッグ
const asyncCode = `
async function fetchData(url) {
    console.log('Fetching:', url);
    const response = await fetch(url);
    const data = await response.json();
    return data;
}

async function main() {
    try {
        const result = await fetchData('https://api.example.com/data');
        console.log('Result:', result);
    } catch (error) {
        console.error('Failed:', error);
    }
}

main();
`;

// async/await の各ステップでデバッグ
mcp__dap-dev__debug_set_breakpoints({
  sessionId: "async-debug",
  source: "/path/to/async.js",
  lines: [3, 4, 5, 11, 12]  // 各 await ポイント
})
```

## サポートされているデバッグアダプター

### ビルトインアダプター

- **`node` / `nodejs`**: Node.js用の組み込みデバッガー（追加設定不要）

### 外部アダプター

以下のアダプターは別途インストールが必要：

- **Python**: `debugpy`
  ```bash
  pip install debugpy
  ```

- **Go**: `dlv` (Delve)
  ```bash
  go install github.com/go-delve/delve/cmd/dlv@latest
  ```

- **Rust**: `rust-analyzer` または `lldb`
  ```bash
  rustup component add rust-analyzer
  ```

- **C/C++**: `gdb` または `lldb`
- **Java**: `java-debug`

### カスタムアダプター

独自のDAPアダプターを使用する場合：

```typescript
mcp__dap-dev__debug_launch({
  sessionId: "custom-debug",
  adapter: "/path/to/custom-adapter",  // 実行可能ファイルのパス
  adapterArgs: ["--port", "5678"],     // アダプターへの引数
  program: "/path/to/program"
})
```

## トラブルシューティング

### よくあるエラーと対処法

#### "No active thread" エラー
- **原因**: プログラムがまだ開始されていない、または既に終了している
- **対処**: `debug_continue` で実行を開始するか、新しいセッションを作成

#### "Session already exists" エラー
- **原因**: 同じIDのセッションが既に存在する
- **対処**: 別のセッションIDを使用するか、既存のセッションを終了

#### タイムアウトエラー
- **原因**: デバッグアダプターが10秒以内に応答しない
- **対処**: プログラムが無限ループに入っていないか確認

#### "Cannot find source" エラー
- **原因**: 指定されたソースファイルが存在しない
- **対処**: 絶対パスが正しいか確認

### デバッグのベストプラクティス

1. **一意のセッションID**: 分かりやすく重複しないIDを使用
2. **ブレークポイントの事前設定**: `continue` の前にブレークポイントを設定
3. **変数スコープの確認**: 変数にアクセスする前にスコープを確認
4. **リソースの解放**: 使用後は必ず `disconnect` でセッションを終了
5. **エラーハンドリング**: try-catch でエラーを適切に処理

## 内部動作の仕組み

### アーキテクチャ

DAP MCPは3層構造で実装されています：

1. **MCPレイヤー** (`dap-mcp.ts`)
   - MCPツールとしてのインターフェース
   - セッション管理（Map でセッションを保持）

2. **DebugSessionレイヤー** (`debugSession.ts`)
   - 高レベルのデバッグ操作API
   - 状態管理とイベント処理

3. **DAPClientレイヤー** (`dapClient.ts`)
   - 低レベルのDAP通信
   - プロセス管理とメッセージング

### セッション作成の流れ

1. `debug_launch` が呼ばれる
2. `DebugSession` インスタンスが作成される
3. `DAPClient` が `spawn()` でデバッグアダプタープロセスを起動
4. 標準入出力でDAPプロトコル通信を確立
5. 初期化シーケンスを実行
6. セッションがMapに保存され、以降の操作で使用可能に

### 通信プロトコル

- **形式**: Content-Length ヘッダー付きのJSON-RPC
- **チャネル**: stdin/stdout を使用
- **メッセージタイプ**: request/response/event

```
Content-Length: 119\r\n
\r\n
{"seq":1,"type":"request","command":"initialize","arguments":{"clientID":"dap-mcp","adapterID":"node"}}
```

### イベント処理

デバッグアダプターからのイベント：
- `stopped`: ブレークポイントで停止
- `continued`: 実行再開
- `terminated`: プログラム終了
- `output`: コンソール出力

これらのイベントはDebugSessionで処理され、適切な状態更新が行われます。