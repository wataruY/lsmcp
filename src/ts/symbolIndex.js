"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectSymbolIndexer = void 0;
const ts_morph_1 = require("ts-morph");
const fs_1 = require("fs");
const path_1 = require("path");
const glob_1 = require("glob");
const _mcplib_ts_1 = require("../mcp/_mcplib.ts");
class ProjectSymbolIndexer {
    index;
    project;
    rootPath;
    constructor(project, rootPath) {
        this.project = project;
        this.rootPath = rootPath;
        this.index = {
            symbols: new Map(),
            modules: new Map(),
            lastUpdated: new Date(),
        };
    }
    /**
     * Build or rebuild the symbol index for the entire project
     */
    async buildIndex(includePatterns = ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"]) {
        (0, _mcplib_ts_1.debug)("Building project symbol index...");
        const startTime = Date.now();
        // Clear existing index
        this.index.symbols.clear();
        this.index.modules.clear();
        // Find all source files
        const files = [];
        for (const pattern of includePatterns) {
            const matches = await (0, glob_1.glob)(pattern, {
                cwd: this.rootPath,
                ignore: ["**/node_modules/**", "**/dist/**", "**/*.d.ts"],
                absolute: false,
            });
            files.push(...matches);
        }
        (0, _mcplib_ts_1.debug)(`Found ${files.length} files to index`);
        // Process each file
        for (const file of files) {
            const filePath = (0, path_1.join)(this.rootPath, file);
            if ((0, fs_1.existsSync)(filePath)) {
                try {
                    const sourceFile = this.project.addSourceFileAtPath(filePath);
                    this.indexSourceFile(sourceFile);
                }
                catch (error) {
                    (0, _mcplib_ts_1.debug)(`Error indexing file ${file}: ${error}`);
                }
            }
        }
        this.index.lastUpdated = new Date();
        const duration = Date.now() - startTime;
        (0, _mcplib_ts_1.debug)(`Symbol index built in ${duration}ms. Total symbols: ${this.index.symbols.size}`);
    }
    /**
     * Index a single source file
     */
    indexSourceFile(sourceFile) {
        const filePath = (0, path_1.relative)(this.rootPath, sourceFile.getFilePath());
        const exportedSymbols = [];
        // Get all exported symbols
        const exportedDeclarations = sourceFile.getExportedDeclarations();
        for (const [name, declarations] of exportedDeclarations) {
            exportedSymbols.push(name);
            for (const declaration of declarations) {
                const symbolInfo = this.createSymbolInfo(declaration, name, filePath, true);
                if (symbolInfo) {
                    this.addSymbolToIndex(symbolInfo);
                }
            }
        }
        // Store module exports
        if (exportedSymbols.length > 0) {
            this.index.modules.set(filePath, exportedSymbols);
        }
        // Also index top-level non-exported symbols for workspace-wide search
        sourceFile.forEachChild((node) => {
            if (this.isDeclarationNode(node)) {
                const symbol = node.getSymbol();
                if (symbol && !exportedSymbols.includes(symbol.getName())) {
                    const symbolInfo = this.createSymbolInfo(node, symbol.getName(), filePath, false);
                    if (symbolInfo) {
                        this.addSymbolToIndex(symbolInfo);
                    }
                }
            }
        });
    }
    /**
     * Create symbol information from a node
     */
    createSymbolInfo(node, name, filePath, isExported) {
        const sourceFile = node.getSourceFile();
        const start = node.getStart();
        const pos = sourceFile.getLineAndColumnAtPos(start);
        const symbolInfo = {
            name,
            kind: this.getSymbolKind(node),
            filePath,
            line: pos.line,
            character: pos.column,
            isExported,
        };
        // Add documentation if available
        const symbol = node.getSymbol();
        if (symbol) {
            const jsDocTags = symbol.getJsDocTags();
            if (jsDocTags.length > 0) {
                symbolInfo.documentation = jsDocTags
                    .map(tag => `${tag.getName()}: ${tag.getText()}`)
                    .join("\n");
            }
        }
        return symbolInfo;
    }
    /**
     * Get the kind of symbol from a node
     */
    getSymbolKind(node) {
        switch (node.getKind()) {
            case ts_morph_1.SyntaxKind.FunctionDeclaration:
            case ts_morph_1.SyntaxKind.FunctionExpression:
            case ts_morph_1.SyntaxKind.ArrowFunction:
            case ts_morph_1.SyntaxKind.MethodDeclaration:
                return "Function";
            case ts_morph_1.SyntaxKind.ClassDeclaration:
            case ts_morph_1.SyntaxKind.ClassExpression:
                return "Class";
            case ts_morph_1.SyntaxKind.InterfaceDeclaration:
                return "Interface";
            case ts_morph_1.SyntaxKind.TypeAliasDeclaration:
                return "TypeAlias";
            case ts_morph_1.SyntaxKind.EnumDeclaration:
                return "Enum";
            case ts_morph_1.SyntaxKind.VariableDeclaration:
                return "Variable";
            case ts_morph_1.SyntaxKind.PropertyDeclaration:
            case ts_morph_1.SyntaxKind.PropertySignature:
                return "Property";
            case ts_morph_1.SyntaxKind.ModuleDeclaration:
                return "Module";
            default:
                return "Unknown";
        }
    }
    /**
     * Check if a node is a declaration
     */
    isDeclarationNode(node) {
        const kind = node.getKind();
        return (kind === ts_morph_1.SyntaxKind.FunctionDeclaration ||
            kind === ts_morph_1.SyntaxKind.ClassDeclaration ||
            kind === ts_morph_1.SyntaxKind.InterfaceDeclaration ||
            kind === ts_morph_1.SyntaxKind.TypeAliasDeclaration ||
            kind === ts_morph_1.SyntaxKind.EnumDeclaration ||
            kind === ts_morph_1.SyntaxKind.VariableStatement ||
            kind === ts_morph_1.SyntaxKind.ModuleDeclaration);
    }
    /**
     * Add a symbol to the index
     */
    addSymbolToIndex(symbolInfo) {
        const existing = this.index.symbols.get(symbolInfo.name) || [];
        existing.push(symbolInfo);
        this.index.symbols.set(symbolInfo.name, existing);
    }
    /**
     * Search for symbols by name (prefix match)
     */
    searchSymbols(query, options) {
        const results = [];
        const { exact = false, includeNonExported = false, kinds, limit = 50 } = options || {};
        for (const [name, symbols] of this.index.symbols) {
            if (exact ? name === query : name.startsWith(query)) {
                for (const symbol of symbols) {
                    if (!includeNonExported && !symbol.isExported)
                        continue;
                    if (kinds && !kinds.includes(symbol.kind))
                        continue;
                    results.push(symbol);
                    if (results.length >= limit) {
                        return results;
                    }
                }
            }
        }
        return results;
    }
    /**
     * Get all exported symbols from a module
     */
    getModuleExports(modulePath) {
        return this.index.modules.get(modulePath) || [];
    }
    /**
     * Find symbols that could be imported for a given name
     */
    findImportCandidates(symbolName) {
        return this.searchSymbols(symbolName, {
            exact: true,
            includeNonExported: false,
        });
    }
    /**
     * Get the current index
     */
    getIndex() {
        return this.index;
    }
    /**
     * Get index statistics
     */
    getStats() {
        const symbolsByKind = new Map();
        for (const symbols of this.index.symbols.values()) {
            for (const symbol of symbols) {
                const count = symbolsByKind.get(symbol.kind) || 0;
                symbolsByKind.set(symbol.kind, count + 1);
            }
        }
        return {
            totalSymbols: this.index.symbols.size,
            totalModules: this.index.modules.size,
            lastUpdated: this.index.lastUpdated,
            symbolsByKind,
        };
    }
}
exports.ProjectSymbolIndexer = ProjectSymbolIndexer;
