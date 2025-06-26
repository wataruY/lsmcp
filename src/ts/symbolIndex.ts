import { Project, SourceFile, Node, SyntaxKind } from "ts-morph";
import { existsSync } from "fs";
import { join, relative } from "path";
import { glob } from "glob";
import { debug } from "../mcp/_mcplib.ts";

export interface SymbolInfo {
  name: string;
  kind: string;
  filePath: string;
  line: number;
  character: number;
  isExported: boolean;
  moduleName?: string;
  documentation?: string;
}

export interface SymbolIndex {
  symbols: Map<string, SymbolInfo[]>;
  modules: Map<string, string[]>; // module path -> exported symbol names
  lastUpdated: Date;
}

export class ProjectSymbolIndexer {
  private index: SymbolIndex;
  private project: Project;
  private rootPath: string;

  constructor(project: Project, rootPath: string) {
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
  async buildIndex(includePatterns: string[] = ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"]): Promise<void> {
    debug("Building project symbol index...");
    const startTime = Date.now();

    // Clear existing index
    this.index.symbols.clear();
    this.index.modules.clear();

    // Find all source files
    const files: string[] = [];
    for (const pattern of includePatterns) {
      const matches = await glob(pattern, {
        cwd: this.rootPath,
        ignore: ["**/node_modules/**", "**/dist/**", "**/*.d.ts"],
        absolute: false,
      });
      files.push(...matches);
    }

    debug(`Found ${files.length} files to index`);

    // Process each file
    for (const file of files) {
      const filePath = join(this.rootPath, file);
      if (existsSync(filePath)) {
        try {
          const sourceFile = this.project.addSourceFileAtPath(filePath);
          this.indexSourceFile(sourceFile);
        } catch (error) {
          debug(`Error indexing file ${file}: ${error}`);
        }
      }
    }

    this.index.lastUpdated = new Date();
    const duration = Date.now() - startTime;
    debug(`Symbol index built in ${duration}ms. Total symbols: ${this.index.symbols.size}`);
  }

  /**
   * Index a single source file
   */
  private indexSourceFile(sourceFile: SourceFile): void {
    const filePath = relative(this.rootPath, sourceFile.getFilePath());
    const exportedSymbols: string[] = [];

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
  private createSymbolInfo(node: Node, name: string, filePath: string, isExported: boolean): SymbolInfo | null {
    const sourceFile = node.getSourceFile();
    const start = node.getStart();
    const pos = sourceFile.getLineAndColumnAtPos(start);

    const symbolInfo: SymbolInfo = {
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
  private getSymbolKind(node: Node): string {
    switch (node.getKind()) {
      case SyntaxKind.FunctionDeclaration:
      case SyntaxKind.FunctionExpression:
      case SyntaxKind.ArrowFunction:
      case SyntaxKind.MethodDeclaration:
        return "Function";
      case SyntaxKind.ClassDeclaration:
      case SyntaxKind.ClassExpression:
        return "Class";
      case SyntaxKind.InterfaceDeclaration:
        return "Interface";
      case SyntaxKind.TypeAliasDeclaration:
        return "TypeAlias";
      case SyntaxKind.EnumDeclaration:
        return "Enum";
      case SyntaxKind.VariableDeclaration:
        return "Variable";
      case SyntaxKind.PropertyDeclaration:
      case SyntaxKind.PropertySignature:
        return "Property";
      case SyntaxKind.ModuleDeclaration:
        return "Module";
      default:
        return "Unknown";
    }
  }

  /**
   * Check if a node is a declaration
   */
  private isDeclarationNode(node: Node): boolean {
    const kind = node.getKind();
    return (
      kind === SyntaxKind.FunctionDeclaration ||
      kind === SyntaxKind.ClassDeclaration ||
      kind === SyntaxKind.InterfaceDeclaration ||
      kind === SyntaxKind.TypeAliasDeclaration ||
      kind === SyntaxKind.EnumDeclaration ||
      kind === SyntaxKind.VariableStatement ||
      kind === SyntaxKind.ModuleDeclaration
    );
  }

  /**
   * Add a symbol to the index
   */
  private addSymbolToIndex(symbolInfo: SymbolInfo): void {
    const existing = this.index.symbols.get(symbolInfo.name) || [];
    existing.push(symbolInfo);
    this.index.symbols.set(symbolInfo.name, existing);
  }

  /**
   * Search for symbols by name (prefix match)
   */
  searchSymbols(query: string, options?: {
    exact?: boolean;
    includeNonExported?: boolean;
    kinds?: string[];
    limit?: number;
  }): SymbolInfo[] {
    const results: SymbolInfo[] = [];
    const { exact = false, includeNonExported = false, kinds, limit = 50 } = options || {};

    for (const [name, symbols] of this.index.symbols) {
      if (exact ? name === query : name.startsWith(query)) {
        for (const symbol of symbols) {
          if (!includeNonExported && !symbol.isExported) continue;
          if (kinds && !kinds.includes(symbol.kind)) continue;
          
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
  getModuleExports(modulePath: string): string[] {
    return this.index.modules.get(modulePath) || [];
  }

  /**
   * Find symbols that could be imported for a given name
   */
  findImportCandidates(symbolName: string): SymbolInfo[] {
    return this.searchSymbols(symbolName, {
      exact: true,
      includeNonExported: false,
    });
  }

  /**
   * Get the current index
   */
  getIndex(): SymbolIndex {
    return this.index;
  }

  /**
   * Get index statistics
   */
  getStats(): {
    totalSymbols: number;
    totalModules: number;
    lastUpdated: Date;
    symbolsByKind: Map<string, number>;
  } {
    const symbolsByKind = new Map<string, number>();
    
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