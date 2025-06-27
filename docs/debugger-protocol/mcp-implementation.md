# Debug Adapter Protocol MCP実装ガイド

## 概要

このガイドでは、Debug Adapter Protocol (DAP) をModel Context Protocol (MCP) ツールとして実装する方法を説明します。

## アーキテクチャ設計

### 全体構成

```
┌─────────────┐     MCP      ┌─────────────┐     DAP      ┌──────────────┐
│  AI Model   │ ←─────────→  │  MCP Server │ ←─────────→  │Debug Adapter │
│  (Client)   │              │  (Bridge)   │              │   (Server)   │
└─────────────┘              └─────────────┘              └──────────────┘
```

### MCP Serverの役割

1. **プロトコル変換**
   - MCP ツール呼び出し → DAP リクエスト
   - DAP レスポンス/イベント → MCP レスポンス

2. **セッション管理**
   - デバッグセッションのライフサイクル管理
   - 複数セッションの同時管理

3. **状態管理**
   - デバッグ状態の追跡
   - ブレークポイント情報の保持

## 実装構造

### ディレクトリ構成

```
src/
  dap/
    client/
      dapClient.ts         # DAP クライアント実装
      messageHandler.ts    # メッセージハンドリング
      transport.ts         # 通信層（stdio）
    types/
      protocol.ts          # DAP プロトコル型定義
      events.ts           # イベント型定義
      requests.ts         # リクエスト型定義
    tools/
      session.ts          # セッション管理ツール
      breakpoints.ts      # ブレークポイント管理ツール
      execution.ts        # 実行制御ツール
      inspection.ts       # 状態検査ツール
    utils/
      pathMapping.ts      # パスマッピング
      errorHandler.ts     # エラーハンドリング
  mcp/
    debugger-mcp.ts       # MCP サーバー実装
```

## 主要コンポーネント

### 1. DAP Client実装

```typescript
// src/dap/client/dapClient.ts
import { EventEmitter } from 'events';
import { ChildProcess, spawn } from 'child_process';

export class DAPClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private sequenceNumber = 1;
  private pendingRequests = new Map<number, {
    resolve: (response: any) => void;
    reject: (error: Error) => void;
  }>();

  async connect(command: string, args: string[]): Promise<void> {
    this.process = spawn(command, args);
    
    // メッセージハンドリングのセットアップ
    this.setupMessageHandling();
    
    // 初期化
    await this.initialize();
  }

  async sendRequest<T>(command: string, args?: any): Promise<T> {
    const seq = this.sequenceNumber++;
    
    const request = {
      seq,
      type: 'request',
      command,
      arguments: args
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(seq, { resolve, reject });
      this.sendMessage(request);
    });
  }

  private sendMessage(message: any): void {
    const json = JSON.stringify(message);
    const contentLength = Buffer.byteLength(json, 'utf8');
    
    this.process!.stdin!.write(
      `Content-Length: ${contentLength}\r\n\r\n${json}`
    );
  }

  private setupMessageHandling(): void {
    let buffer = '';
    
    this.process!.stdout!.on('data', (data: Buffer) => {
      buffer += data.toString();
      
      while (true) {
        const message = this.tryParseMessage(buffer);
        if (!message) break;
        
        buffer = message.remainder;
        this.handleMessage(message.parsed);
      }
    });
  }

  private handleMessage(message: any): void {
    switch (message.type) {
      case 'response':
        this.handleResponse(message);
        break;
      case 'event':
        this.emit(message.event, message.body);
        break;
    }
  }
}
```

### 2. MCP Tools実装

#### セッション管理ツール

```typescript
// src/dap/tools/session.ts
export const launchDebugSessionTool: ToolDef = {
  name: "debug_launch",
  description: "新しいデバッグセッションを開始します",
  schema: z.object({
    adapter: z.string().describe("デバッグアダプター名 (node, python, etc.)"),
    program: z.string().describe("実行するプログラムのパス"),
    args: z.array(z.string()).optional().describe("プログラム引数"),
    cwd: z.string().optional().describe("作業ディレクトリ"),
    env: z.record(z.string()).optional().describe("環境変数"),
    stopOnEntry: z.boolean().optional().describe("エントリーで停止")
  }),
  execute: async (args) => {
    const client = await getOrCreateDAPClient(args.adapter);
    
    const response = await client.sendRequest('launch', {
      program: args.program,
      args: args.args,
      cwd: args.cwd,
      env: args.env,
      stopOnEntry: args.stopOnEntry
    });
    
    return `デバッグセッションを開始しました: ${args.program}`;
  }
};

export const attachDebugSessionTool: ToolDef = {
  name: "debug_attach",
  description: "実行中のプロセスにアタッチします",
  schema: z.object({
    adapter: z.string().describe("デバッグアダプター名"),
    processId: z.number().optional().describe("プロセスID"),
    port: z.number().optional().describe("デバッグポート"),
    host: z.string().optional().describe("ホスト名")
  }),
  execute: async (args) => {
    const client = await getOrCreateDAPClient(args.adapter);
    
    const response = await client.sendRequest('attach', {
      processId: args.processId,
      port: args.port,
      host: args.host
    });
    
    return `プロセスにアタッチしました`;
  }
};
```

#### ブレークポイント管理ツール

```typescript
// src/dap/tools/breakpoints.ts
export const setBreakpointsTool: ToolDef = {
  name: "debug_set_breakpoints",
  description: "ブレークポイントを設定します",
  schema: z.object({
    file: z.string().describe("ファイルパス"),
    lines: z.array(z.number()).describe("行番号の配列"),
    conditions: z.array(z.string()).optional().describe("条件式の配列"),
    hitConditions: z.array(z.string()).optional().describe("ヒット条件の配列")
  }),
  execute: async (args) => {
    const client = getCurrentDAPClient();
    if (!client) throw new Error("デバッグセッションが開始されていません");
    
    const breakpoints = args.lines.map((line, index) => ({
      line,
      condition: args.conditions?.[index],
      hitCondition: args.hitConditions?.[index]
    }));
    
    const response = await client.sendRequest('setBreakpoints', {
      source: { path: args.file },
      breakpoints
    });
    
    const verified = response.body.breakpoints.filter(bp => bp.verified).length;
    return `${verified}/${args.lines.length} 個のブレークポイントを設定しました`;
  }
};
```

#### 実行制御ツール

```typescript
// src/dap/tools/execution.ts
export const continueTool: ToolDef = {
  name: "debug_continue",
  description: "実行を継続します",
  schema: z.object({
    threadId: z.number().optional().describe("スレッドID")
  }),
  execute: async (args) => {
    const client = getCurrentDAPClient();
    if (!client) throw new Error("デバッグセッションが開始されていません");
    
    const threadId = args.threadId || await getActiveThreadId();
    await client.sendRequest('continue', { threadId });
    
    return "実行を継続しました";
  }
};

export const stepOverTool: ToolDef = {
  name: "debug_step_over",
  description: "次の行まで実行します（ステップオーバー）",
  schema: z.object({
    threadId: z.number().optional().describe("スレッドID")
  }),
  execute: async (args) => {
    const client = getCurrentDAPClient();
    if (!client) throw new Error("デバッグセッションが開始されていません");
    
    const threadId = args.threadId || await getActiveThreadId();
    await client.sendRequest('next', { threadId });
    
    return "次の行まで実行しました";
  }
};
```

#### 状態検査ツール

```typescript
// src/dap/tools/inspection.ts
export const getStackTraceTool: ToolDef = {
  name: "debug_stacktrace",
  description: "現在のスタックトレースを取得します",
  schema: z.object({
    threadId: z.number().optional().describe("スレッドID"),
    startFrame: z.number().optional().describe("開始フレーム"),
    levels: z.number().optional().describe("取得レベル数")
  }),
  execute: async (args) => {
    const client = getCurrentDAPClient();
    if (!client) throw new Error("デバッグセッションが開始されていません");
    
    const threadId = args.threadId || await getActiveThreadId();
    const response = await client.sendRequest('stackTrace', {
      threadId,
      startFrame: args.startFrame,
      levels: args.levels
    });
    
    return formatStackTrace(response.body.stackFrames);
  }
};

export const getVariablesTool: ToolDef = {
  name: "debug_variables",
  description: "変数の値を取得します",
  schema: z.object({
    frameId: z.number().optional().describe("フレームID"),
    scopeName: z.string().optional().describe("スコープ名 (locals, globals, etc.)")
  }),
  execute: async (args) => {
    const client = getCurrentDAPClient();
    if (!client) throw new Error("デバッグセッションが開始されていません");
    
    const frameId = args.frameId || await getActiveFrameId();
    const scopes = await client.sendRequest('scopes', { frameId });
    
    const targetScope = args.scopeName 
      ? scopes.body.scopes.find(s => s.name === args.scopeName)
      : scopes.body.scopes[0];
    
    if (!targetScope) {
      throw new Error(`スコープ '${args.scopeName}' が見つかりません`);
    }
    
    const variables = await client.sendRequest('variables', {
      variablesReference: targetScope.variablesReference
    });
    
    return formatVariables(variables.body.variables);
  }
};

export const evaluateExpressionTool: ToolDef = {
  name: "debug_evaluate",
  description: "式を評価します",
  schema: z.object({
    expression: z.string().describe("評価する式"),
    frameId: z.number().optional().describe("フレームID"),
    context: z.enum(['watch', 'repl', 'hover', 'clipboard']).optional()
  }),
  execute: async (args) => {
    const client = getCurrentDAPClient();
    if (!client) throw new Error("デバッグセッションが開始されていません");
    
    const response = await client.sendRequest('evaluate', {
      expression: args.expression,
      frameId: args.frameId,
      context: args.context || 'repl'
    });
    
    return `${args.expression} = ${response.body.result}`;
  }
};
```

### 3. イベント処理

```typescript
// src/dap/client/eventHandlers.ts
export function setupEventHandlers(client: DAPClient): void {
  // 停止イベント
  client.on('stopped', async (event) => {
    const reason = event.reason;
    const threadId = event.threadId;
    
    // 状態を更新
    updateDebugState({
      stopped: true,
      activeThread: threadId,
      stopReason: reason
    });
    
    // 自動的にスタックトレースを取得
    if (reason === 'breakpoint' || reason === 'exception') {
      await cacheStackTrace(threadId);
    }
  });
  
  // 出力イベント
  client.on('output', (event) => {
    const category = event.category;
    const output = event.output;
    
    // 出力をバッファリング
    appendOutput(category, output);
  });
  
  // 終了イベント
  client.on('terminated', () => {
    clearDebugState();
  });
}
```

## エラーハンドリング

### 接続エラー

```typescript
async function connectWithRetry(
  command: string, 
  args: string[], 
  maxRetries = 3
): Promise<DAPClient> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const client = new DAPClient();
      await client.connect(command, args);
      return client;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await delay(1000 * (i + 1));
    }
  }
  throw new Error("接続に失敗しました");
}
```

### タイムアウト処理

```typescript
async function sendRequestWithTimeout<T>(
  client: DAPClient,
  command: string,
  args: any,
  timeout = 5000
): Promise<T> {
  return Promise.race([
    client.sendRequest<T>(command, args),
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error("タイムアウト")), timeout)
    )
  ]);
}
```

## 使用例

### 基本的なデバッグフロー

```typescript
// 1. デバッグセッションを開始
await debugLaunch({
  adapter: "node",
  program: "/path/to/app.js",
  stopOnEntry: true
});

// 2. ブレークポイントを設定
await debugSetBreakpoints({
  file: "/path/to/app.js",
  lines: [10, 20, 30]
});

// 3. 実行を継続
await debugContinue({});

// 4. ブレークポイントで停止したら変数を検査
await debugVariables({
  scopeName: "locals"
});

// 5. 式を評価
await debugEvaluate({
  expression: "myVariable.length"
});

// 6. ステップ実行
await debugStepOver({});

// 7. セッションを終了
await debugDisconnect({});
```

## パフォーマンス最適化

### 1. 変数の遅延読み込み

```typescript
export const getVariableDetailsToold: ToolDef = {
  name: "debug_variable_details",
  description: "変数の詳細を取得します（大きなオブジェクト用）",
  schema: z.object({
    variablesReference: z.number(),
    start: z.number().optional(),
    count: z.number().optional()
  }),
  execute: async (args) => {
    const response = await client.sendRequest('variables', {
      variablesReference: args.variablesReference,
      start: args.start,
      count: args.count || 100
    });
    
    return formatVariables(response.body.variables);
  }
};
```

### 2. イベントのバッチ処理

```typescript
class OutputBuffer {
  private buffer: Map<string, string[]> = new Map();
  private flushTimer: NodeJS.Timeout | null = null;
  
  append(category: string, output: string): void {
    if (!this.buffer.has(category)) {
      this.buffer.set(category, []);
    }
    this.buffer.get(category)!.push(output);
    
    this.scheduleFlush();
  }
  
  private scheduleFlush(): void {
    if (this.flushTimer) return;
    
    this.flushTimer = setTimeout(() => {
      this.flush();
      this.flushTimer = null;
    }, 100);
  }
  
  private flush(): void {
    for (const [category, outputs] of this.buffer) {
      const combined = outputs.join('');
      // MCPクライアントに送信
      sendOutput(category, combined);
    }
    this.buffer.clear();
  }
}
```

## セキュリティ考慮事項

### 1. パス検証

```typescript
function validatePath(path: string): void {
  // 絶対パスの確認
  if (!path.isAbsolute(path)) {
    throw new Error("絶対パスを指定してください");
  }
  
  // ディレクトリトラバーサルの防止
  if (path.includes('..')) {
    throw new Error("無効なパスです");
  }
  
  // 許可されたディレクトリ内かチェック
  if (!isWithinAllowedDirectory(path)) {
    throw new Error("アクセスが拒否されました");
  }
}
```

### 2. コマンドインジェクション対策

```typescript
function validateAdapterCommand(adapter: string): string {
  const allowedAdapters = {
    'node': 'node',
    'python': 'python',
    'go': 'dlv'
  };
  
  if (!allowedAdapters[adapter]) {
    throw new Error(`未対応のアダプター: ${adapter}`);
  }
  
  return allowedAdapters[adapter];
}
```

## まとめ

DAPをMCPツールとして実装することで、AIモデルがデバッガーを操作できるようになります。重要なポイント：

1. **プロトコル変換** - MCPとDAPの間の適切な変換
2. **状態管理** - デバッグセッションの状態を正確に追跡
3. **エラーハンドリング** - 堅牢なエラー処理とリカバリー
4. **セキュリティ** - 適切なアクセス制御と検証

このアプローチにより、AIアシスタントがコードのデバッグを支援し、問題の診断と修正を効率化できます。