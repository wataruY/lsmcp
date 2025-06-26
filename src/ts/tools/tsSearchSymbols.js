"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchSymbolsTool = void 0;
const zod_1 = require("zod");
const schemas_ts_1 = require("../../common/schemas.ts");
const projectCache_ts_1 = require("../projectCache.ts");
const symbolIndex_ts_1 = require("../symbolIndex.ts");
const mcpErrors_ts_1 = require("../../common/mcpErrors.ts");
const schema = zod_1.z.object({
    root: schemas_ts_1.commonSchemas.root,
    query: zod_1.z.string().describe("Symbol name to search for (prefix match)"),
    exact: zod_1.z.boolean().optional().default(false).describe("Whether to match exactly"),
    includeNonExported: zod_1.z.boolean().optional().default(false).describe("Include non-exported symbols"),
    kinds: zod_1.z.array(zod_1.z.string()).optional().describe("Filter by symbol kinds (Function, Class, Interface, etc.)"),
    limit: zod_1.z.number().optional().default(50).describe("Maximum number of results"),
    buildIndex: zod_1.z.boolean().optional().default(false).describe("Force rebuild of symbol index"),
});
// Cache for symbol indexers
const indexerCache = new Map();
async function getOrCreateIndexer(root, forceRebuild = false) {
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
    const project = await (0, projectCache_ts_1.getOrCreateProject)(root);
    const indexer = new symbolIndex_ts_1.ProjectSymbolIndexer(project, root);
    // Build index
    await indexer.buildIndex();
    // Cache it
    indexerCache.set(root, {
        indexer,
        lastBuilt: new Date(),
    });
    return indexer;
}
exports.searchSymbolsTool = {
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
            const byFile = new Map();
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
        }
        catch (error) {
            throw new mcpErrors_ts_1.MCPToolError(error instanceof Error ? error.message : String(error), "SEARCH_SYMBOLS_ERROR", ["Check if the project path is correct", "Try rebuilding the index with buildIndex: true"], ["find_references", "get_definitions"]);
        }
    },
};
