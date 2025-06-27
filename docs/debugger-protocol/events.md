# DAPイベント一覧

デバッグアダプターからクライアントに送信される通知イベントの詳細です。

## 初期化・終了イベント

### initialized

デバッグアダプターの初期化が完了し、設定を受け付ける準備ができたことを通知します。

```typescript
interface InitializedEvent {
  event: 'initialized';
}
```

### exited

デバッグ対象が終了したことを通知します。

```typescript
interface ExitedEvent {
  event: 'exited';
  body: {
    exitCode: number;    // 終了コード
  };
}
```

### terminated

デバッグセッションが終了したことを通知します。

```typescript
interface TerminatedEvent {
  event: 'terminated';
  body?: {
    restart?: any;       // 再起動用データ
  };
}
```

## 実行状態イベント

### stopped

実行が停止したことを通知します。

```typescript
interface StoppedEvent {
  event: 'stopped';
  body: {
    reason: StoppedReason;     // 停止理由
    description?: string;      // 説明テキスト
    threadId?: number;         // 停止したスレッドID
    preserveFocusHint?: boolean; // フォーカスを保持
    text?: string;             // 追加テキスト
    allThreadsStopped?: boolean; // 全スレッド停止
    hitBreakpointIds?: number[]; // ヒットしたブレークポイントID
  };
}

type StoppedReason = 
  | 'step'           // ステップ実行完了
  | 'breakpoint'     // ブレークポイント
  | 'exception'      // 例外発生
  | 'pause'          // 一時停止
  | 'entry'          // エントリーポイント
  | 'goto'           // goto実行
  | 'function breakpoint'  // 関数ブレークポイント
  | 'data breakpoint'      // データブレークポイント
  | 'instruction breakpoint' // 命令ブレークポイント
  | string;          // その他
```

### continued

実行が再開されたことを通知します。

```typescript
interface ContinuedEvent {
  event: 'continued';
  body: {
    threadId: number;          // 再開したスレッドID
    allThreadsContinued?: boolean; // 全スレッド再開
  };
}
```

## スレッド関連イベント

### thread

スレッドの開始・終了を通知します。

```typescript
interface ThreadEvent {
  event: 'thread';
  body: {
    reason: 'started' | 'exited'; // 理由
    threadId: number;          // スレッドID
  };
}
```

## 出力イベント

### output

コンソール出力やデバッグ情報を通知します。

```typescript
interface OutputEvent {
  event: 'output';
  body: {
    category?: OutputCategory; // カテゴリ
    output: string;           // 出力テキスト
    group?: 'start' | 'startCollapsed' | 'end'; // グループ化
    variablesReference?: number; // 変数参照
    source?: Source;          // ソース情報
    line?: number;            // 行番号
    column?: number;          // 列番号
    data?: any;              // 追加データ
  };
}

type OutputCategory = 
  | 'console'      // コンソール出力
  | 'important'    // 重要メッセージ
  | 'stdout'       // 標準出力
  | 'stderr'       // 標準エラー
  | 'telemetry'    // テレメトリー
  | string;        // カスタムカテゴリ
```

## ブレークポイントイベント

### breakpoint

ブレークポイントの状態変更を通知します。

```typescript
interface BreakpointEvent {
  event: 'breakpoint';
  body: {
    reason: BreakpointEventReason; // 理由
    breakpoint: Breakpoint;    // ブレークポイント情報
  };
}

type BreakpointEventReason = 
  | 'changed'      // 変更された
  | 'new'          // 新規作成
  | 'removed'      // 削除された
  | string;        // その他
```

## モジュール関連イベント

### module

モジュールのロード・アンロードを通知します。

```typescript
interface ModuleEvent {
  event: 'module';
  body: {
    reason: 'new' | 'changed' | 'removed'; // 理由
    module: Module;           // モジュール情報
  };
}

interface Module {
  id: number | string;        // モジュールID
  name: string;               // モジュール名
  path?: string;              // パス
  isOptimized?: boolean;      // 最適化済み
  isUserCode?: boolean;       // ユーザーコード
  version?: string;           // バージョン
  symbolStatus?: string;      // シンボル状態
  symbolFilePath?: string;    // シンボルファイルパス
  dateTimeStamp?: string;     // タイムスタンプ
  addressRange?: string;      // アドレス範囲
}
```

### loadedSource

ソースのロード・アンロードを通知します。

```typescript
interface LoadedSourceEvent {
  event: 'loadedSource';
  body: {
    reason: 'new' | 'changed' | 'removed'; // 理由
    source: Source;           // ソース情報
  };
}
```

## プロセス関連イベント

### process

プロセスの開始・終了を通知します。

```typescript
interface ProcessEvent {
  event: 'process';
  body: {
    name: string;             // プロセス名
    systemProcessId?: number; // システムプロセスID
    isLocalProcess?: boolean; // ローカルプロセス
    startMethod?: 'launch' | 'attach' | 'attachForSuspendedLaunch'; // 開始方法
    pointerSize?: number;     // ポインタサイズ
  };
}
```

## 機能関連イベント

### capabilities

デバッグアダプターの機能変更を通知します。

```typescript
interface CapabilitiesEvent {
  event: 'capabilities';
  body: {
    capabilities: Capabilities; // 機能一覧
  };
}
```

### progressStart

長時間実行される操作の開始を通知します。

```typescript
interface ProgressStartEvent {
  event: 'progressStart';
  body: {
    progressId: string;       // 進捗ID
    title: string;            // タイトル
    requestId?: number;       // リクエストID
    cancellable?: boolean;    // キャンセル可能
    message?: string;         // メッセージ
    percentage?: number;      // パーセンテージ
  };
}
```

### progressUpdate

進捗の更新を通知します。

```typescript
interface ProgressUpdateEvent {
  event: 'progressUpdate';
  body: {
    progressId: string;       // 進捗ID
    message?: string;         // メッセージ
    percentage?: number;      // パーセンテージ
  };
}
```

### progressEnd

操作の完了を通知します。

```typescript
interface ProgressEndEvent {
  event: 'progressEnd';
  body: {
    progressId: string;       // 進捗ID
    message?: string;         // 完了メッセージ
  };
}
```

### invalidated

無効化された領域を通知します。

```typescript
interface InvalidatedEvent {
  event: 'invalidated';
  body: {
    areas?: InvalidatedAreas[]; // 無効化領域
    threadId?: number;        // スレッドID
    stackFrameId?: number;    // スタックフレームID
  };
}

interface InvalidatedAreas {
  'all' | 'stacks' | 'threads' | 'variables';
}
```

### memory

メモリ内容の変更を通知します。

```typescript
interface MemoryEvent {
  event: 'memory';
  body: {
    memoryReference: string;  // メモリ参照
    offset: number;           // オフセット
    count: number;            // バイト数
  };
}
```

## カスタムイベント

デバッグアダプターは独自のイベントを定義できます。

```typescript
interface CustomEvent {
  event: string;              // カスタムイベント名
  body?: any;                 // カスタムデータ
}
```

## イベントの順序と依存関係

### 典型的なイベントシーケンス

1. **初期化シーケンス**
   ```
   → initialize request
   ← initialize response
   ← initialized event
   ```

2. **実行開始シーケンス**
   ```
   → launch/attach request
   ← process event (optional)
   ← thread event (started)
   ← module events (optional)
   ← launch/attach response
   ```

3. **ブレークポイントヒット**
   ```
   ← stopped event (reason: breakpoint)
   → stackTrace request
   ← stackTrace response
   → scopes request
   ← scopes response
   → variables requests
   ← variables responses
   ```

4. **実行再開**
   ```
   → continue request
   ← continued event
   ← continue response
   ```

5. **プログラム終了**
   ```
   ← thread event (exited)
   ← exited event
   ← terminated event
   ```

## イベント処理のベストプラクティス

### 1. 非同期処理
- イベントは非同期に到着するため、適切なキューイングが必要
- UI更新はメインスレッドで実行

### 2. エラーハンドリング
- 不明なイベントは無視する
- 必須フィールドの検証を実施

### 3. パフォーマンス
- 高頻度イベント（output等）のバッチ処理
- UI更新の最適化

### 4. 状態管理
- イベントに基づく状態遷移の管理
- 不整合状態の検出と回復