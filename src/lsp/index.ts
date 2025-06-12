// Main LSP client exports
export {
  createLSPClient,
  initialize,
  getActiveClient,
  shutdown,
  type LSPClientConfig,
  type HoverResult,
  type DefinitionResult,
  type ReferencesResult,
  type HoverContents,
  type LSPClient,
} from "./lspClient.ts";