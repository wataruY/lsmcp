"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findImportCandidatesTool = void 0;
const zod_1 = require("zod");
const schemas_ts_1 = require("../../common/schemas.ts");
const projectCache_ts_1 = require("../projectCache.ts");
const symbolIndex_ts_1 = require("../symbolIndex.ts");
const mcpErrors_ts_1 = require("../../common/mcpErrors.ts");
const path_1 = require("path");
const schema = zod_1.z.object({
    root: schemas_ts_1.commonSchemas.root,
    symbolName: zod_1.z.string().describe("Symbol name to find import candidates for"),
    currentFile: zod_1.z.string().optional().describe("Current file path to calculate relative imports"),
    limit: zod_1.z.number().optional().default(10).describe("Maximum number of candidates"),
});
// Reuse the indexer cache from tsSearchSymbols
const indexerCache = new Map();
async function getOrCreateIndexer(root) {
    const cached = indexerCache.get(root);
    if (cached) {
        const ageMs = Date.now() - cached.lastBuilt.getTime();
        const maxAgeMs = 5 * 60 * 1000; // 5 minutes
        if (ageMs < maxAgeMs) {
            return cached.indexer;
        }
    }
    const project = await (0, projectCache_ts_1.getOrCreateProject)(root);
    const indexer = new symbolIndex_ts_1.ProjectSymbolIndexer(project, root);
    await indexer.buildIndex();
    indexerCache.set(root, {
        indexer,
        lastBuilt: new Date(),
    });
    return indexer;
}
function calculateImportPath(fromFile, toFile) {
    const fromDir = (0, path_1.dirname)(fromFile);
    const relativePath = (0, path_1.relative)(fromDir, toFile);
    // Remove file extension
    const pathWithoutExt = relativePath.replace(/\.(ts|tsx|js|jsx)$/, "");
    // Add ./ prefix if not starting with . or /
    if (!pathWithoutExt.startsWith(".") && !pathWithoutExt.startsWith("/")) {
        return "./" + pathWithoutExt;
    }
    return pathWithoutExt;
}
exports.findImportCandidatesTool = {
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
                if (a.name === symbolName && b.name !== symbolName)
                    return -1;
                if (b.name === symbolName && a.name !== symbolName)
                    return 1;
                // Exported symbols first
                if (a.isExported && !b.isExported)
                    return -1;
                if (b.isExported && !a.isExported)
                    return 1;
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
                    const absoluteToFile = (0, path_1.join)(root, candidate.filePath);
                    const importPath = calculateImportPath(currentFile, absoluteToFile);
                    output += `   Import: import { ${candidate.name} } from "${importPath}";\n`;
                }
                else {
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
        }
        catch (error) {
            throw new mcpErrors_ts_1.MCPToolError(error instanceof Error ? error.message : String(error), "FIND_IMPORT_CANDIDATES_ERROR", ["Check if the symbol name is correct", "Make sure the project has been indexed"], ["search_symbols", "get_module_symbols"]);
        }
    },
};
