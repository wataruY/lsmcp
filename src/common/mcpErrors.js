"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommonErrors = exports.MCPToolError = void 0;
/**
 * Enhanced error class for MCP tools with helpful suggestions
 */
class MCPToolError extends Error {
    code;
    suggestions;
    relatedTools;
    constructor(message, code, suggestions = [], relatedTools = []) {
        super(message);
        this.code = code;
        this.suggestions = suggestions;
        this.relatedTools = relatedTools;
        this.name = "MCPToolError";
    }
    /**
     * Format the error with suggestions and related tools
     */
    format() {
        let result = `❌ Error: ${this.message}`;
        result += `\n   Code: ${this.code}`;
        if (this.suggestions.length > 0) {
            result += "\n\n💡 Suggestions:";
            this.suggestions.forEach(suggestion => {
                result += `\n   • ${suggestion}`;
            });
        }
        if (this.relatedTools.length > 0) {
            result += "\n\n🔧 Alternative tools you can try:";
            this.relatedTools.forEach(tool => {
                result += `\n   • ${tool}`;
            });
        }
        return result;
    }
}
exports.MCPToolError = MCPToolError;
/**
 * Common error scenarios
 */
exports.CommonErrors = {
    LSP_NOT_RUNNING: () => new MCPToolError("LSP server is not running or not initialized", "LSP_NOT_RUNNING", [
        "Make sure typescript-language-server is installed: npm install -g typescript-language-server",
        "Check if the LSP server process is running",
        "Try using TypeScript tools (non-LSP) instead for similar functionality"
    ], ["get_hover (instead of lsp_get_hover)", "find_references (instead of lsp_find_references)"]),
    FILE_NOT_FOUND: (filePath) => new MCPToolError(`File not found: ${filePath}`, "FILE_NOT_FOUND", [
        "Check if the file path is correct and relative to the root directory",
        "Use forward slashes (/) for path separators",
        "Make sure the file exists in the project"
    ]),
    INVALID_LINE_NUMBER: (line, maxLine) => new MCPToolError(`Invalid line number: ${line}. File has only ${maxLine} lines`, "INVALID_LINE_NUMBER", [
        "Line numbers are 1-based (first line is 1, not 0)",
        "You can also use a string to search for a line containing that text",
        `Valid range for this file: 1-${maxLine}`
    ]),
    SYMBOL_NOT_FOUND: (symbol, line) => new MCPToolError(`Symbol "${symbol}" not found${line ? ` on line ${line}` : ""}`, "SYMBOL_NOT_FOUND", [
        "Check if the symbol name is spelled correctly",
        "The symbol might be on a different line",
        "Use find_references to search for the symbol across the entire file"
    ], ["find_references", "get_workspace_symbols"]),
    RESPONSE_TOO_LARGE: (size, limit) => new MCPToolError(`Response size (${size} tokens) exceeds limit (${limit} tokens)`, "RESPONSE_TOO_LARGE", [
        "Use filters to reduce the response size",
        "Specify a more targeted search query",
        "Use pagination parameters if available",
        "Try searching in a specific directory instead of the whole project"
    ]),
    PARAMETER_REQUIRED: (param, description) => new MCPToolError(`Required parameter missing: ${param}`, "PARAMETER_REQUIRED", [
        description || `The ${param} parameter is required for this tool`,
        "Check the tool schema for required parameters",
        "Use list_tools to see tool descriptions"
    ]),
};
