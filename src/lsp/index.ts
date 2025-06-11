// Main LSP client exports
export {
  createLSPClient,
  type LSPClientConfig,
  type HoverResult,
  type DefinitionResult,
  type ReferencesResult,
  type HoverContents,
} from "./lsp_client.ts";

// Simplified high-level API
export {
  getTypeScriptLSPClient,
  getTsgoLSPClient,
  shutdownAllClients,
  type LSPClientAPI,
} from "../mcp/lsp_client_manager.ts";