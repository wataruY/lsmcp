# DAPメッセージフォーマット

## ワイヤープロトコル

DAPは、HTTPヘッダー風の形式でメッセージをフレーミングします。

### メッセージ構造

```
Content-Length: <バイト数>\r\n
\r\n
<JSONペイロード>
```

### エンコーディング
- **ヘッダー部**: ASCII エンコーディング
- **コンテンツ部**: UTF-8 エンコーディング

### 例

```
Content-Length: 119\r\n
\r\n
{
  "seq": 153,
  "type": "request",
  "command": "next",
  "arguments": {
    "threadId": 3
  }
}
```

## メッセージタイプ

DAPには3種類の基本メッセージタイプがあります。

### 1. Request（リクエスト）

クライアントからデバッグアダプターへの要求。

```typescript
interface Request {
  seq: number;           // シーケンス番号（クライアントが付与）
  type: 'request';       // 固定値
  command: string;       // コマンド名
  arguments?: any;       // コマンド固有の引数
}
```

#### 例：初期化リクエスト

```json
{
  "seq": 1,
  "type": "request",
  "command": "initialize",
  "arguments": {
    "clientID": "vscode",
    "clientName": "Visual Studio Code",
    "adapterID": "node",
    "locale": "ja",
    "linesStartAt1": true,
    "columnsStartAt1": true,
    "pathFormat": "path",
    "supportsVariableType": true,
    "supportsVariablePaging": true,
    "supportsRunInTerminalRequest": true,
    "supportsMemoryReferences": true,
    "supportsProgressReporting": true,
    "supportsInvalidatedEvent": true
  }
}
```

### 2. Response（レスポンス）

リクエストに対するデバッグアダプターからの応答。

```typescript
interface Response {
  seq: number;           // シーケンス番号（アダプターが付与）
  type: 'response';      // 固定値
  request_seq: number;   // 対応するリクエストのseq
  success: boolean;      // 成功/失敗
  command: string;       // 対応するコマンド名
  message?: string;      // エラーメッセージ（失敗時）
  body?: any;           // レスポンスデータ（成功時）
}
```

#### 例：成功レスポンス

```json
{
  "seq": 2,
  "type": "response",
  "request_seq": 1,
  "success": true,
  "command": "initialize",
  "body": {
    "supportsConfigurationDoneRequest": true,
    "supportsFunctionBreakpoints": true,
    "supportsConditionalBreakpoints": true,
    "supportsHitConditionalBreakpoints": true,
    "supportsEvaluateForHovers": true,
    "exceptionBreakpointFilters": [
      {
        "filter": "uncaught",
        "label": "Uncaught Exceptions",
        "default": true
      }
    ],
    "supportsStepBack": false,
    "supportsSetVariable": true,
    "supportsRestartFrame": true,
    "supportsGotoTargetsRequest": true,
    "supportsStepInTargetsRequest": true,
    "supportsCompletionsRequest": true,
    "completionTriggerCharacters": [".", "["],
    "supportsModulesRequest": true,
    "additionalModuleColumns": [
      {
        "attributeName": "version",
        "label": "Version"
      }
    ]
  }
}
```

#### 例：エラーレスポンス

```json
{
  "seq": 10,
  "type": "response",
  "request_seq": 9,
  "success": false,
  "command": "setBreakpoints",
  "message": "ブレークポイントを設定できませんでした",
  "body": {
    "error": {
      "id": 2000,
      "format": "ファイル '{path}' が見つかりません",
      "variables": {
        "path": "/path/to/missing/file.js"
      }
    }
  }
}
```

### 3. Event（イベント）

デバッグアダプターからクライアントへの通知。

```typescript
interface Event {
  seq: number;           // シーケンス番号（アダプターが付与）
  type: 'event';         // 固定値
  event: string;         // イベント名
  body?: any;           // イベントデータ
}
```

#### 例：停止イベント

```json
{
  "seq": 15,
  "type": "event",
  "event": "stopped",
  "body": {
    "reason": "breakpoint",
    "description": "ブレークポイントで停止しました",
    "threadId": 1,
    "preserveFocusHint": false,
    "allThreadsStopped": true,
    "hitBreakpointIds": [1]
  }
}
```

#### 例：出力イベント

```json
{
  "seq": 20,
  "type": "event",
  "event": "output",
  "body": {
    "category": "console",
    "output": "Hello, World!\n",
    "source": {
      "name": "app.js",
      "path": "/workspace/app.js"
    },
    "line": 10,
    "column": 5
  }
}
```

## 共通データ型

### Source（ソースファイル情報）

```typescript
interface Source {
  name?: string;         // ファイル名
  path?: string;         // ファイルパス
  sourceReference?: number; // ソース参照番号
  presentationHint?: 'normal' | 'emphasize' | 'deemphasize';
  origin?: string;       // ソースの起源
  sources?: Source[];    // インライン化されたソース
  adapterData?: any;     // アダプター固有のデータ
  checksums?: Checksum[]; // チェックサム
}
```

### StackFrame（スタックフレーム）

```typescript
interface StackFrame {
  id: number;            // フレームID
  name: string;          // 関数名など
  source?: Source;       // ソース情報
  line: number;          // 行番号
  column: number;        // 列番号
  endLine?: number;      // 終了行
  endColumn?: number;    // 終了列
  canRestart?: boolean;  // リスタート可能か
  instructionPointerReference?: string; // 命令ポインタ
  moduleId?: number | string; // モジュールID
  presentationHint?: 'normal' | 'label' | 'subtle';
}
```

### Breakpoint（ブレークポイント）

```typescript
interface Breakpoint {
  id?: number;           // ブレークポイントID
  verified: boolean;     // 検証済みか
  message?: string;      // 追加情報
  source?: Source;       // ソース情報
  line?: number;         // 行番号
  column?: number;       // 列番号
  endLine?: number;      // 終了行
  endColumn?: number;    // 終了列
  instructionReference?: string; // 命令参照
  offset?: number;       // 行からのオフセット
}
```

### Variable（変数）

```typescript
interface Variable {
  name: string;          // 変数名
  value: string;         // 値の文字列表現
  type?: string;         // 型情報
  presentationHint?: VariablePresentationHint;
  evaluateName?: string; // 評価可能な式
  variablesReference: number; // 子要素参照
  namedVariables?: number; // 名前付き子要素数
  indexedVariables?: number; // インデックス付き子要素数
  memoryReference?: string; // メモリ参照
}

interface VariablePresentationHint {
  kind?: 'property' | 'method' | 'class' | 'data' | 'event' | 
         'baseClass' | 'innerClass' | 'interface' | 'mostDerivedClass' | 
         'virtual' | 'dataBreakpoint';
  attributes?: ('static' | 'constant' | 'readOnly' | 'rawString' | 
                'hasObjectId' | 'canHaveObjectId' | 'hasSideEffects' | 
                'hasDataBreakpoint')[];
  visibility?: 'public' | 'private' | 'protected' | 'internal' | 'final';
}
```

## エラーハンドリング

### ErrorResponse

```typescript
interface ErrorResponse extends Response {
  success: false;
  message: string;       // ユーザー向けエラーメッセージ
  body?: {
    error?: Message;     // 詳細なエラー情報
  };
}

interface Message {
  id: number;            // エラーID
  format: string;        // メッセージフォーマット（{変数}を含む）
  variables?: { [key: string]: string }; // 変数の値
  sendTelemetry?: boolean; // テレメトリー送信フラグ
  showUser?: boolean;    // ユーザー表示フラグ
  url?: string;          // 詳細情報URL
  urlLabel?: string;     // URLのラベル
}
```

## メッセージシーケンスの例

### 典型的な初期化シーケンス

```
Client                          Debug Adapter
  |                                   |
  |------- initialize request ------->|
  |<------ initialize response -------|
  |<------ initialized event ---------|
  |                                   |
  |-- setBreakpoints request x N ---->|
  |<-- setBreakpoints response x N ---|
  |                                   |
  |-- configurationDone request ----->|
  |<-- configurationDone response ----|
  |                                   |
  |------- launch request ----------->|
  |<------ launch response -----------|
  |                                   |
  |<------ stopped event -------------|
  |                                   |
```

## パフォーマンス考慮事項

### ストリーミング
- 大量のデータ（変数など）はページング対応
- `variablesReference` による遅延読み込み

### バッチ処理
- 複数のブレークポイントを一度に設定
- 効率的なメッセージ送信

### キャッシング
- ソースファイルのキャッシュ
- 変数値の再利用