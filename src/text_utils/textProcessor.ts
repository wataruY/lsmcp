/**
 * Core text processing utilities
 * Re-exports from individual function modules
 */

export { findLinesContaining } from "./findLinesContaining.ts";
export { findSymbolOccurrences } from "./findSymbolOccurrences.ts";
export { 
  resolveLineParameter, 
  type LineResolutionResult 
} from "./resolveLineParameter.ts";
export { 
  findSymbolPosition, 
  type SymbolPositionResult 
} from "./findSymbolPosition.ts";
export { findTextInFile } from "./findTextInFile.ts";