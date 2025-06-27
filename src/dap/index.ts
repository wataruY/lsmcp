/**
 * Debug Adapter Protocol (DAP) Client
 * 
 * Minimal public interface for DAP client functionality
 */

export { DAPClient } from "./dapClient.ts";

// Re-export essential types
export type {
  DAPRequest,
  DAPResponse,
  DAPEvent,
  DAPMessage,
  InitializeRequestArguments,
  InitializeResponse,
  StackTraceArguments,
  StackTraceResponse,
  ScopesArguments,
  ScopesResponse,
  VariablesArguments,
  VariablesResponse,
  EvaluateArguments,
  EvaluateResponse,
  SetBreakpointsArguments,
  SetBreakpointsResponse,
  ContinueArguments,
  ContinueResponse,
  NextArguments,
  StepInArguments,
  StepOutArguments,
  ThreadsResponse,
  StoppedEvent,
  OutputEvent,
  TerminatedEvent,
  InitializedEvent,
} from "./types.ts";

// Export utility functions
export { createDebugSession, DebugSession } from "./debugSession.ts";