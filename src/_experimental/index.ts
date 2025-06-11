// LSP Client implementation using tsgo from @typescript/native-preview
export { findReferencesWithLSP } from "./lsp_find_references.ts";
export { getDefinitionsWithLSP } from "./lsp_get_definitions.ts";
export { getHoverWithLSP } from "./lsp_get_hover.ts";

// Re-export types
export type {
  FindReferencesRequest,
  Reference,
  FindReferencesSuccess,
} from "./lsp_find_references.ts";

export type {
  GetDefinitionsRequest,
  Definition,
  GetDefinitionsSuccess,
} from "./lsp_get_definitions.ts";

export type {
  GetHoverRequest,
  HoverInfo,
  GetHoverSuccess,
} from "./lsp_get_hover.ts";
