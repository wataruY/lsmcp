import { z } from "zod";
import type { ToolDef } from "../../mcp/_mcplib.ts";
import { commonSchemas } from "../../common/schemas.ts";
import { getOrCreateProject } from "../projectCache.ts";
import { ProjectSymbolIndexer } from "../symbolIndex.ts";
import { MCPToolError } from "../../common/mcpErrors.ts";

const schema = z.object({
  root: commonSchemas.root,
  query: z.string().describe("Symbol name to search for (prefix match)"),
  exact: z.boolean().optional().default(false).describe("Whether to match exactly"),
  includeNonExported: z.boolean().optional().default(false).describe("Include non-exported symbols"),
  kinds: z.array(z.string()).optional().describe("Filter by symbol kinds (Function, Class, Interface, etc.)"),
  limit: z.number().optional().default(50).describe("Maximum number of results"),
  buildIndex: z.boolean().optional().default(false).describe("Force rebuild of symbol index"),
});

// Cache for symbol indexers
const indexerCache = new Map<string, { indexer: ProjectSymbolIndexer; lastBuilt: Date }>();

async function getOrCreateIndexer(root: string, forceRebuild: boolean = false): Promise<ProjectSymbolIndexer> {
  const cached = indexerCache.get(root);
  
  // Use cached indexer if available and not forcing rebuild
  if (cached && !forceRebuild) {
    const ageMs = Date.now() - cached.lastBuilt.getTime();
    const maxAgeMs = 5 * 60 * 1000; // 5 minutes
    
    if (ageMs < maxAgeMs) {
      return cached.indexer;
    }
  }

  // Create new indexer
  const project = await getOrCreateProject(root);
  const indexer = new ProjectSymbolIndexer(project, root);
  
  // Build index
  await indexer.buildIndex();
  
  // Cache it
  indexerCache.set(root, {
    indexer,
    lastBuilt: new Date(),
  });

  return indexer;
}

export const searchSymbolsTool: ToolDef<typeof schema> = {
  name: "lsmcp_search_symbols",
  description: "Search for symbols across the entire project using a pre-built index (fast)",
  schema,
  execute: async ({ root, query, exact, includeNonExported, kinds, limit, buildIndex }) => {
    try {
      const indexer = await getOrCreateIndexer(root, buildIndex);
      
      const results = indexer.searchSymbols(query, {
        exact,
        includeNonExported,
        kinds,
        limit,
      });

      if (results.length === 0) {
        return `No symbols found matching "${query}"`;
      }

      // Group results by file
      const byFile = new Map<string, typeof results>();
      for (const result of results) {
        const fileResults = byFile.get(result.filePath) || [];
        fileResults.push(result);
        byFile.set(result.filePath, fileResults);
      }

      // Format results
      let output = `Found ${results.length} symbols matching "${query}":\n\n`;

      for (const [filePath, fileResults] of byFile) {
        output += `📄 ${filePath}\n`;
        for (const symbol of fileResults) {
          const exported = symbol.isExported ? "✓" : " ";
          output += `  ${exported} ${symbol.name} [${symbol.kind}] - line ${symbol.line}\n`;
          if (symbol.documentation) {
            output += `    ${symbol.documentation.split('\n')[0]}\n`;
          }
        }
        output += "\n";
      }

      // Add statistics
      const stats = indexer.getStats();
      output += `\n📊 Index stats: ${stats.totalSymbols} symbols, ${stats.totalModules} modules`;
      output += `\n⏱️  Last updated: ${stats.lastUpdated.toISOString()}`;

      return output;
    } catch (error) {
      throw new MCPToolError(
        error instanceof Error ? error.message : String(error),
        "SEARCH_SYMBOLS_ERROR",
        ["Check if the project path is correct", "Try rebuilding the index with buildIndex: true"],
        ["find_references", "get_definitions"]
      );
    }
  },
};