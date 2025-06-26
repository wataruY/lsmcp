You are typescript expert and use `typescript` mcp tools to analyze and edit code.

Given a URL, use read_url_content_as_markdown and summary contents

## CRITICAL: Tool Usage Priority for Refactoring

**When performing refactoring operations (rename, move, etc.) on TypeScript/JavaScript code, ALWAYS use typescript MCP tools (`mcp__typescript_*`) instead of the default Edit/Write tools.**

Specifically for refactoring:

- For renaming symbols: ALWAYS use `mcp__typescript__rename_symbol` instead of Edit/Write
- For moving files: ALWAYS use `mcp__typescript__move_file` instead of Bash(mv) or Write
- For moving directories: ALWAYS use `mcp__typescript__move_directory` instead of Bash(mv)
- For finding references: ALWAYS use `mcp__typescript__find_references` instead of Grep/Bash(grep)
- For type analysis: ALWAYS use `mcp__typescript__get_type_*` tools

**NEVER use Edit, MultiEdit, or Write tools for TypeScript refactoring operations that have a corresponding mcp\__typescript_\* tool.**

## Project Goal

Provide typescript LSP features as MCP.

## Development Stack

- pnpm
- typescript
- ts-morph: manipulate typescript project
- tsdown: rolldown based bundler

## Coding Rules

- file: snake_case
- add `.ts` extensions to import. eg. `import {} from "./x.ts"` for deno compatibility.

## Git Workflow

Claude Code follows this Git workflow:

1. **Auto-staging after tests pass**: When tests pass successfully, automatically stage changes using `git add`
2. **Smart commit on user request**: When user requests a commit, analyze the current staged diff to generate an appropriate commit message, then commit
3. **Commit all on request**: When user says "commit all" with no staged changes:
   - Check current `git status` to identify all changes
   - Stage all changes using `git add -A`
   - Generate commit message based on all changes and commit

## Code Modification Workflow

When modifying code in this project:

### 1. Development Commands
```bash
# Build the project
pnpm build

# Run tests
pnpm test

# Type checking
pnpm typecheck     # Using tsgo (faster)
pnpm typecheck:tsc # Using tsc (standard)

# Linting
pnpm lint          # Run with --quiet flag
pnpm lint:refactor # Run without --quiet for all messages
```

### 2. Testing Strategy
- Unit tests are located alongside source files using Vitest's in-source testing
- Integration tests are in the `tests/` directory
- Run specific tests: `pnpm test -- path/to/test.ts`
- Run tests matching pattern: `pnpm test -- -t "pattern"`

### 3. Code Quality Checks
Before committing, always run:
1. `pnpm typecheck` - Ensure no TypeScript errors
2. `pnpm lint` - Check for linting issues
3. `pnpm test` - Verify all tests pass

### 4. Refactoring Guidelines
- Use TypeScript MCP tools for semantic refactoring
- Maintain snake_case for filenames
- Always include `.ts` extension in imports
- Follow existing patterns in the codebase

## Directory Patterns

```
dist/               # Build output directory
  typescript-mcp.js # TypeScript-specific MCP server executable
  lsmcp.js         # Main unified LSP MCP CLI executable
  generic-lsp-mcp.js # Generic LSP MCP server executable
  moonbit-mcp.js   # Moonbit MCP server executable
  rust-mcp.js      # Rust MCP server executable
  multi-language-mcp.js # Multi-language MCP server executable

src/
  lsp/             # LSP client implementation
    tools/         # LSP-based MCP tools
    lspClient.ts   # LSP client core
    lspTypes.ts    # TypeScript types for LSP
    
  ts/              # TypeScript Compiler API and ts-morph
    commands/      # Operations with side effects (move, rename, delete)
    navigations/   # Read-only analysis operations
    tools/         # TypeScript MCP tool implementations
    projectCache.ts # Project instance caching
    
  mcp/             # MCP server implementations
    _mcplib.ts     # Generic MCP server library
    typescript-mcp.ts # TypeScript MCP server
    unified-mcp.ts # Unified LSP MCP CLI (outputs as lsmcp.js)
    generic-lsp-mcp.ts # Generic LSP MCP server
    moonbit-mcp.ts # Moonbit MCP server
    rust-mcp.ts    # Rust MCP server
    multi-language-mcp.ts # Multi-language MCP server
    languageServerInit.ts # Shared language server initialization
    
  textUtils/       # Text manipulation utilities

tests/             # Integration tests
  mcp-client.test.ts
  mcp-integration.test.ts
  move_file.test.ts
  rename.test.ts

.claude/           # Claude-specific configuration
  commands/        # Custom command definitions
  settings.json    # Permissions configuration
```

## Architecture Overview

### MCP Server Library (`_mcplib.ts`)
The project uses a generic MCP server library that provides:
- `BaseMcpServer` class for common server functionality
- Automatic permission generation from tool definitions
- `debug()` function for stderr output (required for MCP protocol)
- Configuration file helpers for `.mcp.json` and `.claude/settings.json`

### TypeScript Project Management
- Uses `ts-morph` for TypeScript AST manipulation
- Project instances are cached for performance
- Supports both tsconfig-based and default projects
- File dependency resolution is disabled by default for performance

### Tool Implementation Pattern
Each tool follows this structure:
```typescript
export const toolNameTool: ToolDef<typeof schema> = {
  name: "tool_name",
  description: "Tool description",
  schema: z.object({ /* parameters */ }),
  execute: async (args) => {
    // Implementation
    return resultString;
  }
};
```

### Common Utilities
- `src/ts/utils/moduleResolution.ts` - Shared module path resolution logic
- `src/ts/utils/symbolNavigation.ts` - Common helpers for finding nodes and symbols
- `src/ts/utils/toolHandlers.ts` - Shared tool preparation and context setup
- `src/mcp/languageServerInit.ts` - Unified language server initialization

## Memories

- AI はワードカウントが苦手なので、LSPのLine Character ではなく、一致する行と、一致するコードでインターフェースを調整する必要があります。既存のコードを参考に、そうなってないMCPサーバーのインターフェースを調整します。

## Recent Changes (2025-01-26)

1. **Added Python MCP Tests**
   - `tests/python-mcp.test.ts` - Comprehensive Python MCP server tests
   - `tests/python-lsmcp.test.ts` - Python language detection and lsmcp integration tests

2. **Code Duplication Refactoring**
   - Extracted common `resolveModulePath` function to `src/ts/utils/moduleResolution.ts`
   - Created shared navigation helpers in `src/ts/utils/symbolNavigation.ts`
   - Unified tool handlers with `src/ts/utils/toolHandlers.ts`
   - Consolidated language server initialization in `src/mcp/languageServerInit.ts`

3. **Multi-language Support Improvements**
   - Added `--include` option for batch diagnostics with glob patterns
   - Enhanced language detection for Python, Go, Java, and other languages
   - Improved error handling and user feedback

## TODO

- [ ] Multi Project support
- [ ] Extract function refactoring
- [ ] Add Java MCP tests
- [x] Fix MCP client tests for move_file and delete_symbol ✅ 2025-01-13
- [x] Add Python MCP tests ✅ 2025-01-26
- [x] Refactor code duplication ✅ 2025-01-26

## LICENSE

MIT