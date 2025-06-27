/**
 * DAP Protocol Type Definitions
 * Based on Debug Adapter Protocol specification
 */

// Base message types
export interface DAPMessage {
  seq: number;
  type: "request" | "response" | "event";
}

export interface DAPRequest extends DAPMessage {
  type: "request";
  command: string;
  arguments?: any;
}

export interface DAPResponse extends DAPMessage {
  type: "response";
  request_seq: number;
  success: boolean;
  command: string;
  message?: string;
  body?: any;
}

export interface DAPEvent extends DAPMessage {
  type: "event";
  event: string;
  body?: any;
}

// Initialize
export interface InitializeRequestArguments {
  clientID?: string;
  clientName?: string;
  adapterID: string;
  locale?: string;
  linesStartAt1?: boolean;
  columnsStartAt1?: boolean;
  pathFormat?: "path" | "uri";
  supportsVariableType?: boolean;
  supportsVariablePaging?: boolean;
  supportsRunInTerminalRequest?: boolean;
  supportsMemoryReferences?: boolean;
  supportsProgressReporting?: boolean;
  supportsInvalidatedEvent?: boolean;
}

export interface InitializeResponse {
  supportsConfigurationDoneRequest?: boolean;
  supportsFunctionBreakpoints?: boolean;
  supportsConditionalBreakpoints?: boolean;
  supportsEvaluateForHovers?: boolean;
  supportsStepBack?: boolean;
  supportsSetVariable?: boolean;
  supportsRestartFrame?: boolean;
  supportsStepInTargetsRequest?: boolean;
  supportsCompletionsRequest?: boolean;
  supportsModulesRequest?: boolean;
  [key: string]: any;
}

// Stack trace
export interface StackTraceArguments {
  threadId: number;
  startFrame?: number;
  levels?: number;
  format?: StackFrameFormat;
}

export interface StackFrameFormat {
  parameters?: boolean;
  parameterTypes?: boolean;
  parameterNames?: boolean;
  parameterValues?: boolean;
  line?: boolean;
  module?: boolean;
}

export interface StackTraceResponse {
  stackFrames: StackFrame[];
  totalFrames?: number;
}

export interface StackFrame {
  id: number;
  name: string;
  source?: Source;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  canRestart?: boolean;
  instructionPointerReference?: string;
  moduleId?: number | string;
  presentationHint?: "normal" | "label" | "subtle";
}

export interface Source {
  name?: string;
  path?: string;
  sourceReference?: number;
  presentationHint?: "normal" | "emphasize" | "deemphasize";
  origin?: string;
  sources?: Source[];
  adapterData?: any;
  checksums?: Checksum[];
}

export interface Checksum {
  algorithm: "MD5" | "SHA1" | "SHA256" | "timestamp";
  checksum: string;
}

// Scopes
export interface ScopesArguments {
  frameId: number;
}

export interface ScopesResponse {
  scopes: Scope[];
}

export interface Scope {
  name: string;
  presentationHint?: "arguments" | "locals" | "registers" | string;
  variablesReference: number;
  namedVariables?: number;
  indexedVariables?: number;
  expensive: boolean;
  source?: Source;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

// Variables
export interface VariablesArguments {
  variablesReference: number;
  filter?: "indexed" | "named";
  start?: number;
  count?: number;
  format?: ValueFormat;
}

export interface ValueFormat {
  hex?: boolean;
}

export interface VariablesResponse {
  variables: Variable[];
}

export interface Variable {
  name: string;
  value: string;
  type?: string;
  presentationHint?: VariablePresentationHint;
  evaluateName?: string;
  variablesReference: number;
  namedVariables?: number;
  indexedVariables?: number;
  memoryReference?: string;
}

export interface VariablePresentationHint {
  kind?: "property" | "method" | "class" | "data" | "event" | 
         "baseClass" | "innerClass" | "interface" | "mostDerivedClass" | 
         "virtual" | "dataBreakpoint" | string;
  attributes?: string[];
  visibility?: "public" | "private" | "protected" | "internal" | "final";
}

// Evaluate
export interface EvaluateArguments {
  expression: string;
  frameId?: number;
  context?: "watch" | "repl" | "hover" | "clipboard" | "variables";
  format?: ValueFormat;
}

export interface EvaluateResponse {
  result: string;
  type?: string;
  presentationHint?: VariablePresentationHint;
  variablesReference: number;
  namedVariables?: number;
  indexedVariables?: number;
  memoryReference?: string;
}

// Breakpoints
export interface SetBreakpointsArguments {
  source: Source;
  breakpoints?: SourceBreakpoint[];
  lines?: number[];
  sourceModified?: boolean;
}

export interface SourceBreakpoint {
  line: number;
  column?: number;
  condition?: string;
  hitCondition?: string;
  logMessage?: string;
}

export interface SetBreakpointsResponse {
  breakpoints: Breakpoint[];
}

export interface Breakpoint {
  id?: number;
  verified: boolean;
  message?: string;
  source?: Source;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  instructionReference?: string;
  offset?: number;
}

// Execution control
export interface ContinueArguments {
  threadId: number;
  singleThread?: boolean;
}

export interface ContinueResponse {
  allThreadsContinued?: boolean;
}

export interface NextArguments {
  threadId: number;
  singleThread?: boolean;
  granularity?: SteppingGranularity;
}

export interface StepInArguments {
  threadId: number;
  singleThread?: boolean;
  targetId?: number;
  granularity?: SteppingGranularity;
}

export interface StepOutArguments {
  threadId: number;
  singleThread?: boolean;
  granularity?: SteppingGranularity;
}

export type SteppingGranularity = "statement" | "line" | "instruction";

// Threads
export interface ThreadsResponse {
  threads: Thread[];
}

export interface Thread {
  id: number;
  name: string;
}

// Events
export interface StoppedEvent {
  reason: "step" | "breakpoint" | "exception" | "pause" | "entry" | 
          "goto" | "function breakpoint" | "data breakpoint" | 
          "instruction breakpoint" | string;
  description?: string;
  threadId?: number;
  preserveFocusHint?: boolean;
  text?: string;
  allThreadsStopped?: boolean;
  hitBreakpointIds?: number[];
}

export interface ContinuedEvent {
  threadId: number;
  allThreadsContinued?: boolean;
}

export interface OutputEvent {
  category?: "console" | "important" | "stdout" | "stderr" | 
             "telemetry" | string;
  output: string;
  group?: "start" | "startCollapsed" | "end";
  variablesReference?: number;
  source?: Source;
  line?: number;
  column?: number;
  data?: any;
}

export interface TerminatedEvent {
  restart?: any;
}

export interface InitializedEvent {
  // Empty event
}

export interface ExitedEvent {
  exitCode: number;
}

export interface ThreadEvent {
  reason: "started" | "exited";
  threadId: number;
}

// Launch/Attach configurations (adapter-specific)
export interface LaunchRequestArguments {
  noDebug?: boolean;
  __restart?: any;
  [key: string]: any;
}

export interface AttachRequestArguments {
  __restart?: any;
  [key: string]: any;
}

// Disconnect
export interface DisconnectArguments {
  restart?: boolean;
  terminateDebuggee?: boolean;
  suspendDebuggee?: boolean;
}

// Configuration done
export interface ConfigurationDoneArguments {
  // Empty
}