# MCP Server Improvements Proposal

## 1. 自動LSPサーバー起動とヘルスチェック

### 現在の問題
- LSPサーバーが起動していないと、LSPツールが動作しない
- エラーメッセージが不親切

### 改善案

```typescript
// src/lsp/tools/lspCommon.ts に追加
export async function ensureLSPServerRunning(): Promise<void> {
  const client = getLSPClient();
  if (!client) {
    // 自動的にLSPサーバーを起動
    const lspProcess = spawn("typescript-language-server", ["--stdio"]);
    await initializeLSPClient(process.cwd(), lspProcess);
  }
  
  // ヘルスチェック
  const isHealthy = await client.checkHealth();
  if (!isHealthy) {
    throw new Error("LSP server is not responding. Please check your TypeScript Language Server installation.");
  }
}

// 各LSPツールの実行前に呼び出す
export async function withLSPServer<T>(
  fn: () => Promise<T>
): Promise<T> {
  await ensureLSPServerRunning();
  return fn();
}
```

## 2. 統一されたツール命名規則とドキュメント

### 改善案

```typescript
// src/mcp/tool-registry.ts
export const TOOL_CATEGORIES = {
  typescript: {
    prefix: "ts_",
    description: "TypeScript Compiler API based tools (fast, no LSP needed)",
    tools: [
      "ts_get_module_symbols",
      "ts_get_type_info",
      "ts_find_references",
      "ts_rename_symbol",
    ]
  },
  lsp: {
    prefix: "lsp_",
    description: "Language Server Protocol based tools (supports all LSP features)",
    tools: [
      "lsp_get_hover",
      "lsp_get_completion",
      "lsp_get_diagnostics",
      "lsp_format_document",
    ]
  }
};

// ツール一覧を表示するヘルパーツール
export const listToolsTool: ToolDef = {
  name: "list_available_tools",
  description: "List all available MCP tools with their categories",
  schema: z.object({}),
  execute: async () => {
    return formatToolRegistry(TOOL_CATEGORIES);
  }
};
```

## 3. レスポンスサイズ制限への対応

### 改善案

```typescript
// src/common/pagination.ts
export interface PaginationParams {
  limit?: number;
  offset?: number;
  filter?: string;
}

export function paginateResponse<T>(
  items: T[],
  params: PaginationParams,
  formatter: (item: T) => string
): string {
  const { limit = 50, offset = 0, filter } = params;
  
  let filtered = items;
  if (filter) {
    filtered = items.filter(item => 
      JSON.stringify(item).toLowerCase().includes(filter.toLowerCase())
    );
  }
  
  const paginated = filtered.slice(offset, offset + limit);
  const hasMore = offset + limit < filtered.length;
  
  let result = paginated.map(formatter).join("\n\n");
  
  if (hasMore) {
    result += `\n\n... ${filtered.length - offset - limit} more items. Use offset: ${offset + limit} to see more.`;
  }
  
  return result;
}
```

## 4. より親切なエラーメッセージとヘルプ

### 改善案

```typescript
// src/common/errors.ts
export class MCPToolError extends Error {
  constructor(
    message: string,
    public readonly suggestions: string[] = [],
    public readonly relatedTools: string[] = []
  ) {
    super(message);
  }
  
  toString(): string {
    let result = this.message;
    
    if (this.suggestions.length > 0) {
      result += "\n\n💡 Suggestions:";
      this.suggestions.forEach(s => {
        result += `\n  - ${s}`;
      });
    }
    
    if (this.relatedTools.length > 0) {
      result += "\n\n🔧 Related tools you might want to try:";
      this.relatedTools.forEach(t => {
        result += `\n  - ${t}`;
      });
    }
    
    return result;
  }
}

// 使用例
throw new MCPToolError(
  "LSP server is not running",
  [
    "Make sure typescript-language-server is installed globally",
    "Run: npm install -g typescript-language-server", 
    "Or use TypeScript tools (ts_*) which don't require LSP"
  ],
  ["ts_get_hover", "ts_get_type_info"]
);
```

## 5. インタラクティブな初期設定ガイド

### 改善案

```typescript
// src/mcp/setup-wizard.ts
export const setupWizardTool: ToolDef = {
  name: "setup_mcp_server",
  description: "Interactive setup wizard for MCP server configuration",
  schema: z.object({
    mode: z.enum(["typescript", "lsp", "both"]).optional(),
  }),
  execute: async ({ mode }) => {
    const steps = [];
    
    // Check environment
    steps.push("🔍 Checking environment...");
    
    // Check TypeScript
    const hasTypeScript = await checkTypeScriptInstalled();
    steps.push(hasTypeScript 
      ? "✅ TypeScript found" 
      : "❌ TypeScript not found - run: npm install typescript"
    );
    
    // Check LSP
    const hasLSP = await checkLSPServerInstalled();
    steps.push(hasLSP
      ? "✅ TypeScript Language Server found"
      : "❌ TypeScript Language Server not found - run: npm install -g typescript-language-server"
    );
    
    // Recommend tools based on setup
    if (hasTypeScript && !hasLSP) {
      steps.push("\n📌 Recommended: Use TypeScript tools (ts_*) for now");
    } else if (hasTypeScript && hasLSP) {
      steps.push("\n🎉 All tools are available!");
    }
    
    return steps.join("\n");
  }
};
```

## 6. 実行例を含むヘルプシステム

### 改善案

```typescript
// src/mcp/help.ts
export const helpTool: ToolDef = {
  name: "help",
  description: "Get help and examples for a specific tool",
  schema: z.object({
    toolName: z.string().describe("Name of the tool to get help for"),
  }),
  execute: async ({ toolName }) => {
    const examples = {
      "ts_get_module_symbols": `
# Get all exported symbols from a module
tool: ts_get_module_symbols
arguments:
  root: /path/to/project
  moduleName: ./src/utils/helpers.ts

# Example output:
Found 5 symbols in module "./src/utils/helpers.ts"
📋 Types: ErrorResult, SuccessResult
⚡ Functions: parseJSON, formatDate, isEmpty
`,
      // ... more examples
    };
    
    return examples[toolName] || `No examples found for ${toolName}. Try 'list_available_tools' to see all tools.`;
  }
};
```

## まとめ

これらの改善により：
1. LSPサーバーの自動起動により、手動設定が不要に
2. 統一された命名規則で、ツールの発見が容易に
3. ページネーションにより、大きなレスポンスも処理可能に
4. 親切なエラーメッセージで、問題解決が簡単に
5. セットアップウィザードで、初期設定をガイド
6. 実行例により、ツールの使い方が明確に