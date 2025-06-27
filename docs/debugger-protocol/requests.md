# DAPリクエスト一覧

## 初期化関連

### initialize

デバッグセッションを初期化し、クライアントとアダプターの機能をネゴシエーションします。

```typescript
interface InitializeRequest {
  command: 'initialize';
  arguments: InitializeRequestArguments;
}

interface InitializeRequestArguments {
  clientID?: string;         // クライアントの識別子
  clientName?: string;       // クライアントの表示名
  adapterID: string;         // アダプターの識別子
  locale?: string;           // ロケール (例: 'ja', 'en-US')
  linesStartAt1?: boolean;   // 行番号が1から始まるか (デフォルト: true)
  columnsStartAt1?: boolean; // 列番号が1から始まるか (デフォルト: true)
  pathFormat?: 'path' | 'uri'; // パスの形式
  supportsVariableType?: boolean;      // 変数の型情報サポート
  supportsVariablePaging?: boolean;    // 変数のページングサポート
  supportsRunInTerminalRequest?: boolean; // ターミナル実行サポート
  supportsMemoryReferences?: boolean;  // メモリ参照サポート
  supportsProgressReporting?: boolean; // 進捗レポートサポート
  supportsInvalidatedEvent?: boolean;  // 無効化イベントサポート
}
```

### configurationDone

すべての設定が完了したことを通知します。

```typescript
interface ConfigurationDoneRequest {
  command: 'configurationDone';
  arguments?: ConfigurationDoneArguments;
}
```

## プログラム実行関連

### launch

新しいプロセスを起動してデバッグを開始します。

```typescript
interface LaunchRequest {
  command: 'launch';
  arguments: LaunchRequestArguments;
}

interface LaunchRequestArguments {
  noDebug?: boolean;    // デバッグなしで実行
  __restart?: any;      // リスタート時のデータ
  // その他のフィールドはアダプター固有
}
```

### attach

既存のプロセスにアタッチしてデバッグを開始します。

```typescript
interface AttachRequest {
  command: 'attach';
  arguments: AttachRequestArguments;
}

interface AttachRequestArguments {
  __restart?: any;      // リスタート時のデータ
  // その他のフィールドはアダプター固有
}
```

### restart

デバッグセッションを再起動します。

```typescript
interface RestartRequest {
  command: 'restart';
  arguments?: RestartArguments;
}

interface RestartArguments {
  arguments?: LaunchRequestArguments | AttachRequestArguments;
}
```

### disconnect

デバッグセッションを終了します。

```typescript
interface DisconnectRequest {
  command: 'disconnect';
  arguments?: DisconnectArguments;
}

interface DisconnectArguments {
  restart?: boolean;     // 再起動の準備
  terminateDebuggee?: boolean; // デバッグ対象を終了
  suspendDebuggee?: boolean;   // デバッグ対象を一時停止
}
```

### terminate

デバッグ対象を強制終了します。

```typescript
interface TerminateRequest {
  command: 'terminate';
  arguments?: TerminateArguments;
}

interface TerminateArguments {
  restart?: boolean;     // 再起動の準備
}
```

## ブレークポイント関連

### setBreakpoints

ソースファイルにブレークポイントを設定します。

```typescript
interface SetBreakpointsRequest {
  command: 'setBreakpoints';
  arguments: SetBreakpointsArguments;
}

interface SetBreakpointsArguments {
  source: Source;        // 対象ソースファイル
  breakpoints?: SourceBreakpoint[]; // ブレークポイント配列
  lines?: number[];      // 行番号配列（非推奨）
  sourceModified?: boolean; // ソースが変更されたか
}

interface SourceBreakpoint {
  line: number;          // 行番号
  column?: number;       // 列番号
  condition?: string;    // 条件式
  hitCondition?: string; // ヒット条件
  logMessage?: string;   // ログメッセージ
}
```

### setFunctionBreakpoints

関数名でブレークポイントを設定します。

```typescript
interface SetFunctionBreakpointsRequest {
  command: 'setFunctionBreakpoints';
  arguments: SetFunctionBreakpointsArguments;
}

interface SetFunctionBreakpointsArguments {
  breakpoints: FunctionBreakpoint[];
}

interface FunctionBreakpoint {
  name: string;          // 関数名
  condition?: string;    // 条件式
  hitCondition?: string; // ヒット条件
}
```

### setExceptionBreakpoints

例外ブレークポイントを設定します。

```typescript
interface SetExceptionBreakpointsRequest {
  command: 'setExceptionBreakpoints';
  arguments: SetExceptionBreakpointsArguments;
}

interface SetExceptionBreakpointsArguments {
  filters: string[];     // フィルターID配列
  filterOptions?: ExceptionFilterOptions[]; // 詳細オプション
  exceptionOptions?: ExceptionOptions[]; // 例外パスオプション
}
```

### setDataBreakpoints

データ（変数）の変更を検出するブレークポイントを設定します。

```typescript
interface SetDataBreakpointsRequest {
  command: 'setDataBreakpoints';
  arguments: SetDataBreakpointsArguments;
}

interface SetDataBreakpointsArguments {
  breakpoints: DataBreakpoint[];
}

interface DataBreakpoint {
  dataId: string;        // データID
  accessType?: DataBreakpointAccessType; // アクセスタイプ
  condition?: string;    // 条件式
  hitCondition?: string; // ヒット条件
}
```

### setInstructionBreakpoints

命令レベルのブレークポイントを設定します。

```typescript
interface SetInstructionBreakpointsRequest {
  command: 'setInstructionBreakpoints';
  arguments: SetInstructionBreakpointsArguments;
}

interface SetInstructionBreakpointsArguments {
  breakpoints: InstructionBreakpoint[];
}

interface InstructionBreakpoint {
  instructionReference: string; // 命令参照
  offset?: number;       // オフセット
  condition?: string;    // 条件式
  hitCondition?: string; // ヒット条件
}
```

## 実行制御

### continue

実行を継続します。

```typescript
interface ContinueRequest {
  command: 'continue';
  arguments: ContinueArguments;
}

interface ContinueArguments {
  threadId: number;      // スレッドID
  singleThread?: boolean; // 単一スレッドのみ再開
}
```

### next

次の行まで実行します（ステップオーバー）。

```typescript
interface NextRequest {
  command: 'next';
  arguments: NextArguments;
}

interface NextArguments {
  threadId: number;      // スレッドID
  singleThread?: boolean; // 単一スレッドのみ
  granularity?: SteppingGranularity; // ステップ粒度
}
```

### stepIn

関数内にステップインします。

```typescript
interface StepInRequest {
  command: 'stepIn';
  arguments: StepInArguments;
}

interface StepInArguments {
  threadId: number;      // スレッドID
  singleThread?: boolean; // 単一スレッドのみ
  targetId?: number;     // ターゲットID
  granularity?: SteppingGranularity; // ステップ粒度
}
```

### stepOut

現在の関数から抜け出します。

```typescript
interface StepOutRequest {
  command: 'stepOut';
  arguments: StepOutArguments;
}

interface StepOutArguments {
  threadId: number;      // スレッドID
  singleThread?: boolean; // 単一スレッドのみ
  granularity?: SteppingGranularity; // ステップ粒度
}
```

### stepBack

前の行に戻ります（逆方向ステップ）。

```typescript
interface StepBackRequest {
  command: 'stepBack';
  arguments: StepBackArguments;
}

interface StepBackArguments {
  threadId: number;      // スレッドID
  singleThread?: boolean; // 単一スレッドのみ
  granularity?: SteppingGranularity; // ステップ粒度
}
```

### reverseContinue

逆方向に実行を継続します。

```typescript
interface ReverseContinueRequest {
  command: 'reverseContinue';
  arguments: ReverseContinueArguments;
}

interface ReverseContinueArguments {
  threadId: number;      // スレッドID
  singleThread?: boolean; // 単一スレッドのみ
}
```

### pause

実行を一時停止します。

```typescript
interface PauseRequest {
  command: 'pause';
  arguments: PauseArguments;
}

interface PauseArguments {
  threadId: number;      // スレッドID
}
```

### goto

指定された位置にジャンプします。

```typescript
interface GotoRequest {
  command: 'goto';
  arguments: GotoArguments;
}

interface GotoArguments {
  threadId: number;      // スレッドID
  targetId: number;      // ターゲットID
}
```

## スタック・変数検査

### threads

利用可能なスレッド一覧を取得します。

```typescript
interface ThreadsRequest {
  command: 'threads';
}
```

### stackTrace

スタックトレースを取得します。

```typescript
interface StackTraceRequest {
  command: 'stackTrace';
  arguments: StackTraceArguments;
}

interface StackTraceArguments {
  threadId: number;      // スレッドID
  startFrame?: number;   // 開始フレーム
  levels?: number;       // 取得レベル数
  format?: StackFrameFormat; // フォーマット
}
```

### scopes

スタックフレームのスコープ一覧を取得します。

```typescript
interface ScopesRequest {
  command: 'scopes';
  arguments: ScopesArguments;
}

interface ScopesArguments {
  frameId: number;       // フレームID
}
```

### variables

変数の詳細を取得します。

```typescript
interface VariablesRequest {
  command: 'variables';
  arguments: VariablesArguments;
}

interface VariablesArguments {
  variablesReference: number; // 変数参照
  filter?: 'indexed' | 'named'; // フィルター
  start?: number;        // 開始インデックス
  count?: number;        // 取得数
  format?: ValueFormat;  // フォーマット
}
```

### setVariable

変数の値を設定します。

```typescript
interface SetVariableRequest {
  command: 'setVariable';
  arguments: SetVariableArguments;
}

interface SetVariableArguments {
  variablesReference: number; // 変数参照
  name: string;          // 変数名
  value: string;         // 新しい値
  format?: ValueFormat;  // フォーマット
}
```

## 式評価

### evaluate

式を評価します。

```typescript
interface EvaluateRequest {
  command: 'evaluate';
  arguments: EvaluateArguments;
}

interface EvaluateArguments {
  expression: string;    // 評価する式
  frameId?: number;      // フレームID
  context?: EvaluateContext; // コンテキスト
  format?: ValueFormat;  // フォーマット
}

type EvaluateContext = 'watch' | 'repl' | 'hover' | 'clipboard' | 'variables';
```

### setExpression

式の値を設定します。

```typescript
interface SetExpressionRequest {
  command: 'setExpression';
  arguments: SetExpressionArguments;
}

interface SetExpressionArguments {
  expression: string;    // 式
  value: string;         // 新しい値
  frameId?: number;      // フレームID
  format?: ValueFormat;  // フォーマット
}
```

## その他のリクエスト

### completions

補完候補を取得します。

```typescript
interface CompletionsRequest {
  command: 'completions';
  arguments: CompletionsArguments;
}

interface CompletionsArguments {
  frameId?: number;      // フレームID
  text: string;          // テキスト
  column: number;        // カーソル位置
  line?: number;         // 行番号
}
```

### exceptionInfo

例外情報を取得します。

```typescript
interface ExceptionInfoRequest {
  command: 'exceptionInfo';
  arguments: ExceptionInfoArguments;
}

interface ExceptionInfoArguments {
  threadId: number;      // スレッドID
}
```

### modules

ロードされたモジュール一覧を取得します。

```typescript
interface ModulesRequest {
  command: 'modules';
  arguments?: ModulesArguments;
}

interface ModulesArguments {
  startModule?: number;  // 開始モジュール
  moduleCount?: number;  // 取得数
}
```

### loadedSources

ロードされたソース一覧を取得します。

```typescript
interface LoadedSourcesRequest {
  command: 'loadedSources';
  arguments?: LoadedSourcesArguments;
}
```

### source

ソースコードを取得します。

```typescript
interface SourceRequest {
  command: 'source';
  arguments: SourceArguments;
}

interface SourceArguments {
  source?: Source;       // ソース情報
  sourceReference: number; // ソース参照
}
```

### readMemory

メモリを読み取ります。

```typescript
interface ReadMemoryRequest {
  command: 'readMemory';
  arguments: ReadMemoryArguments;
}

interface ReadMemoryArguments {
  memoryReference: string; // メモリ参照
  offset?: number;       // オフセット
  count: number;         // バイト数
}
```

### writeMemory

メモリに書き込みます。

```typescript
interface WriteMemoryRequest {
  command: 'writeMemory';
  arguments: WriteMemoryArguments;
}

interface WriteMemoryArguments {
  memoryReference: string; // メモリ参照
  offset?: number;       // オフセット
  allowPartial?: boolean; // 部分書き込み許可
  data: string;          // Base64エンコードデータ
}
```

### disassemble

逆アセンブルを実行します。

```typescript
interface DisassembleRequest {
  command: 'disassemble';
  arguments: DisassembleArguments;
}

interface DisassembleArguments {
  memoryReference: string; // メモリ参照
  offset?: number;       // オフセット
  instructionOffset?: number; // 命令オフセット
  instructionCount: number; // 命令数
  resolveSymbols?: boolean; // シンボル解決
}
```