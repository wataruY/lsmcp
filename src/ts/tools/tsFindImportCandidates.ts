import { z } from "zod";
import type { ToolDef } from "../../mcp/_mcplib.ts";
import { commonSchemas } from "../../common/schemas.ts";
import { getOrCreateProject } from "../projectCache.ts";
import { ProjectSymbolIndexer } from "../symbolIndex.ts";
import { MCPToolError } from "../../common/mcpErrors.ts";
import { relative, dirname, join } from "path";

const schema = z.object({
  root: commonSchemas.root,
  symbolName: z.string().describe("Symbol name to find import candidates for"),
  currentFile: z.string().optional().describe("Current file path to calculate relative imports"),
  limit: z.number().optional().default(10).describe("Maximum number of candidates"),
});

// Reuse the indexer cache from tsSearchSymbols
const indexerCache = new Map<string, { indexer: ProjectSymbolIndexer; lastBuilt: Date }>();

async function getOrCreateIndexer(root: string): Promise<ProjectSymbolIndexer> {
  const cached = indexerCache.get(root);
  
  if (cached) {
    const ageMs = Date.now() - cached.lastBuilt.getTime();
    const maxAgeMs = 5 * 60 * 1000; // 5 minutes
    
    if (ageMs < maxAgeMs) {
      return cached.indexer;
    }
  }

  const project = await getOrCreateProject(root);
  const indexer = new ProjectSymbolIndexer(project, root);
  await indexer.buildIndex();
  
  indexerCache.set(root, {
    indexer,
    lastBuilt: new Date(),
  });

  return indexer;
}

function calculateImportPath(fromFile: string, toFile: string): string {
  const fromDir = dirname(fromFile);
  const relativePath = relative(fromDir, toFile);
  
  // Remove file extension
  const pathWithoutExt = relativePath.replace(/\.(ts|tsx|js|jsx)$/, "");
  
  // Add ./ prefix if not starting with . or /
  if (!pathWithoutExt.startsWith(".") && !pathWithoutExt.startsWith("/")) {
    return "./" + pathWithoutExt;
  }
  
  return pathWithoutExt;
}

export const findImportCandidatesTool: ToolDef<typeof schema> = {
  name: "lsmcp_find_import_candidates",
  description: "Find potential import candidates for a symbol name using the symbol index (fast)",
  schema,
  execute: async ({ root, symbolName, currentFile, limit }) => {
    try {
      const indexer = await getOrCreateIndexer(root);
      const candidates = indexer.findImportCandidates(symbolName);

      if (candidates.length === 0) {
        return `No import candidates found for "${symbolName}"`;
      }

      // Sort by relevance (prefer exact matches, then exported symbols)
      const sorted = candidates.sort((a, b) => {
        // Exact name match first
        if (a.name === symbolName && b.name !== symbolName) return -1;
        if (b.name === symbolName && a.name !== symbolName) return 1;
        
        // Exported symbols first
        if (a.isExported && !b.isExported) return -1;
        if (b.isExported && !a.isExported) return 1;
        
        // Prefer certain kinds
        const kindOrder = ["Class", "Interface", "Function", "TypeAlias", "Enum", "Variable"];
        const aIndex = kindOrder.indexOf(a.kind);
        const bIndex = kindOrder.indexOf(b.kind);
        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        }
        
        return 0;
      });

      const limitedCandidates = sorted.slice(0, limit);
      
      let output = `Found ${candidates.length} import candidates for "${symbolName}":\n\n`;

      for (const candidate of limitedCandidates) {
        output += `📦 ${candidate.name} [${candidate.kind}]\n`;
        output += `   File: ${candidate.filePath}\n`;
        
        if (currentFile) {
          const absoluteToFile = join(root, candidate.filePath);
          const importPath = calculateImportPath(currentFile, absoluteToFile);
          output += `   Import: import { ${candidate.name} } from "${importPath}";\n`;
        } else {
          output += `   Import: import { ${candidate.name} } from "./${candidate.filePath.replace(/\.(ts|tsx|js|jsx)$/, "")}";\n`;
        }
        
        if (candidate.documentation) {
          output += `   Docs: ${candidate.documentation.split('\n')[0]}\n`;
        }
        
        output += "\n";
      }

      if (candidates.length > limit) {
        output += `... and ${candidates.length - limit} more candidates`;
      }

      return output;
    } catch (error) {
      throw new MCPToolError(
        error instanceof Error ? error.message : String(error),
        "FIND_IMPORT_CANDIDATES_ERROR",
        ["Check if the symbol name is correct", "Make sure the project has been indexed"],
        ["search_symbols", "get_module_symbols"]
      );
    }
  },
};