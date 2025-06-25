# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### 🌍 Multi-Language Support (2025-01-25)
- **New Language-Specific MCP Servers**:
  - `moonbit-mcp` - Dedicated Moonbit language support
  - `rust-mcp` - Dedicated Rust language support via rust-analyzer
  - `multi-language-mcp` - Automatic language detection and LSP selection
- **Language Detection System**:
  - Automatic project type detection based on config files
  - Support for TypeScript, JavaScript, Moonbit, Rust, Python, Go, Java, C/C++
  - Manual language override with `FORCE_LANGUAGE` environment variable
- **Language-Specific Tool Prefixes**:
  - Moonbit tools: `moonbit_get_hover`, `moonbit_rename_symbol`, etc.
  - Rust tools: `rust_get_hover`, `rust_find_references`, etc.
  - Prevents tool name conflicts between different language servers
- **Infrastructure**:
  - New `languageDetection.ts` module for language configuration
  - Refactored LSP client to support multiple language IDs
  - Updated build configuration to generate 5 separate MCP executables

#### 📚 Documentation
- **README-multi-language.md**: Comprehensive guide for multi-language support
- **examples/moonbit-example.md**: Moonbit usage examples and setup
- **examples/rust-example.md**: Rust usage examples and setup

### Changed
- **Build System**:
  - Updated `tsdown.config.ts` to build multiple MCP servers
  - Added new bin entries in `package.json` for each language server
  - Updated deadcode scripts to include new MCP servers

### Technical Details
- Each language server inherits from the generic LSP-based MCP implementation
- Language servers automatically find and configure their respective LSP servers
- Consistent interface across all languages using LSP protocol
- Moonbit LSP server location: `~/.moon/bin/lsp-server.js`
- Rust LSP via rust-analyzer (requires `rustup component add rust-analyzer`)

## [0.0.14] - 2025-01-24

### Added

#### 🔄 Automatic TypeScript Fallback for LSP Rename (2025-01-24)
- **New**: Automatic fallback mechanism for rename operations
  - Detects when LSP server doesn't support rename (e.g., TypeScript Native Preview)
  - Seamlessly switches to TypeScript Compiler API
  - Maintains consistent interface across all LSP servers
- **LSP Client Enhancements**:
  - Added `prepareRename()` method for rename validation
  - Added `rename()` method with built-in error handling
  - Smart detection of unsupported methods (error code -32601)
- **Benefits**:
  - Works with all LSP servers, even those without rename support
  - Future-proof: automatically uses LSP rename when available
  - Transparent to users - same tool, automatic backend selection

#### 🚀 MCP Server Usability Improvements (2025-01-24)
- **New `list_tools` Command**:
  - Discover all available tools with descriptions
  - Filter by category: `typescript`, `lsp`, or `all`
  - Shows which tools require LSP server
- **Enhanced Error Handling**:
  - New `MCPToolError` class with actionable suggestions
  - Common error scenarios pre-defined
  - Alternative tool recommendations
  - Clear guidance for fixing issues
- **Interface Improvements**:
  - Consistent `line + target` pattern across tools
  - Removed confusing `character` parameter
  - More intuitive parameter names
- **Documentation**:
  - Comprehensive usage guide (`docs/mcp-usage-guide.md`)
  - Improvement proposals (`docs/mcp-improvements.md`)
  - Before/after comparisons showing 80-99% improvement in UX

#### 🌐 Comprehensive LSP Tools Suite (2025-01-24)
- **New LSP Tools**:
  - `lsp_get_completion` - Code completion suggestions
  - `lsp_get_document_symbols` - Document outline/symbols
  - `lsp_get_code_actions` - Quick fixes and refactorings
  - `lsp_get_signature_help` - Function parameter hints
  - `lsp_get_workspace_symbols` - Project-wide symbol search
  - `lsp_format_document` - Code formatting
  - `lsp_delete_symbol` - Delete symbol with references
- **Deno LSP Support**:
  - Added `initializationOptions` for Deno compatibility
  - Support for Deno-specific initialization parameters
  - Handle Deno namespace and permissions API
- **Infrastructure**:
  - Extracted common schemas to `src/common/`
  - Improved error handling across all tools
  - Comprehensive test coverage
  - Better project cache handling

### Changed
- **Breaking**: `lsp_get_completion` now uses `target` instead of `character`
- **Breaking**: `lsp_get_signature_help` now uses `target` instead of `character`

### Fixed
- Project cache now better handles non-TypeScript projects
- LSP tools provide clearer error messages when server is not running

## [0.0.13] - 2025-01-17

### Added
- LSP-based rename symbol tool (`lsp_rename_symbol`)
- Comprehensive test coverage for LSP rename operations
- Multi-file rename tests via MCP protocol

### Fixed
- Replace `findProjectForFile` with `getOrCreateProject` for better project handling
- Update import and export statements to remove file extensions
- Improve error handling in project cache

### Changed
- Improved project initialization for better performance
- Enhanced error messages for file not found scenarios

## [0.0.12] - 2025-01-10

### Added
- Initial release of TypeScript MCP Server
- TypeScript Compiler API tools:
  - `move_file` - Move files with import updates
  - `move_directory` - Move directories with import updates
  - `rename_symbol` - Rename symbols across codebase
  - `delete_symbol` - Delete symbols and references
  - `find_references` - Find all references to a symbol
  - `get_definitions` - Get symbol definitions
  - `get_diagnostics` - Get TypeScript diagnostics
  - `get_module_symbols` - List module exports
  - `get_type_in_module` - Get detailed type info
  - `get_type_at_symbol` - Get type at location
  - `get_symbols_in_scope` - Get available symbols
- Basic LSP integration:
  - `lsp_get_hover` - Hover information
  - `lsp_find_references` - Find references via LSP
  - `lsp_get_definitions` - Get definitions via LSP
  - `lsp_get_diagnostics` - Get diagnostics via LSP
- MCP server infrastructure
- Comprehensive test suite

[Unreleased]: https://github.com/mizchi/typescript-mcp/compare/v0.0.14...HEAD
[0.0.14]: https://github.com/mizchi/typescript-mcp/compare/v0.0.13...v0.0.14
[0.0.13]: https://github.com/mizchi/typescript-mcp/compare/v0.0.12...v0.0.13
[0.0.12]: https://github.com/mizchi/typescript-mcp/releases/tag/v0.0.12