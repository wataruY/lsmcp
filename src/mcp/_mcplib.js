"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseMcpServer = exports.StdioServerTransport = exports.McpServer = void 0;
exports.debug = debug;
exports.toMcpToolHandler = toMcpToolHandler;
exports.createTool = createTool;
exports.readJsonFile = readJsonFile;
exports.writeJsonFile = writeJsonFile;
exports.mergeArrays = mergeArrays;
exports.generatePermissions = generatePermissions;
exports.initializeMcpConfig = initializeMcpConfig;
/**
 * Generic MCP (Model Context Protocol) Server Library
 * Provides utilities and base classes for building MCP servers
 */
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const fs = require("node:fs");
const path = require("node:path");
/**
 * Debug logging for MCP servers.
 *
 * IMPORTANT: MCP servers communicate via stdio, so regular console.log output
 * would interfere with the protocol. All debug/logging output MUST be sent
 * to stderr using console.error instead.
 *
 * This function provides a convenient way to output debug messages that won't
 * interfere with MCP communication.
 *
 * @example
 * debug("Server started");
 * debug("Processing request:", requestData);
 */
function debug(...args) {
    console.error(...args);
}
// Re-export commonly used types from MCP SDK
const mcp_js_2 = require("@modelcontextprotocol/sdk/server/mcp.js");
Object.defineProperty(exports, "McpServer", { enumerable: true, get: function () { return mcp_js_2.McpServer; } });
const stdio_js_2 = require("@modelcontextprotocol/sdk/server/stdio.js");
Object.defineProperty(exports, "StdioServerTransport", { enumerable: true, get: function () { return stdio_js_2.StdioServerTransport; } });
/**
 * Base class for MCP servers with common functionality
 */
class BaseMcpServer {
    server;
    tools = new Map();
    defaultRoot;
    constructor(options) {
        this.server = new mcp_js_1.McpServer({
            name: options.name,
            version: options.version,
        });
    }
    /**
     * Set default root directory for tools that accept a root parameter
     */
    setDefaultRoot(root) {
        this.defaultRoot = root;
    }
    /**
     * Register a tool with the server
     */
    registerTool(tool) {
        this.tools.set(tool.name, tool);
        this._registerToolWithServer(tool);
    }
    /**
     * Register multiple tools at once
     */
    registerTools(tools) {
        for (const tool of tools) {
            this.registerTool(tool);
        }
    }
    /**
     * Start the server with stdio transport
     */
    async start() {
        const transport = new stdio_js_1.StdioServerTransport();
        await this.server.connect(transport);
    }
    /**
     * Get the underlying MCP server instance
     */
    getServer() {
        return this.server;
    }
    /**
     * Internal method to register tool with MCP server
     */
    _registerToolWithServer(tool) {
        // Check if the schema is a ZodObject to extract shape
        if (tool.schema instanceof zod_1.ZodObject) {
            const schemaShape = tool.schema.shape;
            // Create a wrapper handler that adds default root if not provided
            const wrappedHandler = this.defaultRoot && "root" in schemaShape
                ? (args) => {
                    // If root is not provided in args, use the default
                    const argsWithRoot = {
                        ...args,
                        root: args.root || this.defaultRoot,
                    };
                    return tool.execute(argsWithRoot);
                }
                : tool.execute;
            this.server.tool(tool.name, tool.description, schemaShape, toMcpToolHandler(wrappedHandler));
        }
        else {
            // For non-ZodObject schemas, register without shape
            this.server.tool(tool.name, tool.description, toMcpToolHandler(tool.execute));
        }
    }
}
exports.BaseMcpServer = BaseMcpServer;
/**
 * Convert a string-returning handler to MCP response format with error handling
 */
function toMcpToolHandler(handler) {
    return async (args) => {
        try {
            const message = await handler(args);
            return {
                content: [
                    {
                        type: "text",
                        text: message,
                    },
                ],
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error: ${error instanceof Error ? error.message : String(error)}`,
                    },
                ],
                isError: true,
            };
        }
    };
}
/**
 * Create a simple tool definition
 */
function createTool(tool) {
    return tool;
}
/**
 * Read JSON file safely
 */
function readJsonFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return null;
    }
    const content = fs.readFileSync(filePath, "utf-8");
    try {
        return JSON.parse(content);
    }
    catch (e) {
        throw new Error(`Error parsing ${filePath}: ${e}`);
    }
}
/**
 * Write JSON file
 */
function writeJsonFile(filePath, data) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}
/**
 * Merge arrays without duplicates
 */
function mergeArrays(existing, additions) {
    const existingArray = existing || [];
    const additionsArray = additions || [];
    return [...existingArray, ...additionsArray].filter((v, i, arr) => arr.indexOf(v) === i);
}
/**
 * Generate MCP permission names from tool definitions
 * @param serverName The name of the MCP server (used as prefix)
 * @param tools Array of tool definitions
 * @returns Array of permission strings in the format "mcp__<serverName>__<toolName>"
 */
function generatePermissions(serverName, tools) {
    return tools.map(tool => `mcp__${serverName}__${tool.name}`);
}
/**
 * Initialize MCP configuration for a project
 */
function initializeMcpConfig(projectRoot, serverName, config, permissions) {
    const mcpConfigPath = path.join(projectRoot, ".mcp.json");
    const claudeDir = path.join(projectRoot, ".claude");
    const claudeSettingsPath = path.join(claudeDir, "settings.json");
    // Update MCP config
    const existingMcpConfig = readJsonFile(mcpConfigPath) || {};
    const mergedMcpConfig = {
        ...existingMcpConfig,
        mcpServers: {
            ...existingMcpConfig.mcpServers,
            [serverName]: config,
        },
    };
    writeJsonFile(mcpConfigPath, mergedMcpConfig);
    // Update Claude settings
    const existingSettings = readJsonFile(claudeSettingsPath) || {};
    const mergedSettings = {
        ...existingSettings,
        permissions: {
            allow: mergeArrays(existingSettings.permissions?.allow, permissions),
            deny: existingSettings.permissions?.deny || [],
        },
    };
    writeJsonFile(claudeSettingsPath, mergedSettings);
}
// Tests
if (import.meta.vitest) {
    const { describe, it, expect } = import.meta.vitest;
    const { z } = await Promise.resolve().then(() => require("zod"));
    describe("toMcpToolHandler", () => {
        it("should convert string to MCP format when no error occurs", async () => {
            const handler = toMcpToolHandler(() => {
                return "Success message";
            });
            const result = await handler({});
            expect(result).toEqual({
                content: [{ type: "text", text: "Success message" }],
            });
        });
        it("should catch and format errors", async () => {
            const handler = toMcpToolHandler(() => {
                throw new Error("Test error message");
            });
            const result = await handler({});
            expect(result).toEqual({
                content: [{ type: "text", text: "Error: Test error message" }],
                isError: true,
            });
        });
        it("should handle non-Error thrown values", async () => {
            const handler = toMcpToolHandler(() => {
                throw "String error";
            });
            const result = await handler({});
            expect(result).toEqual({
                content: [{ type: "text", text: "Error: String error" }],
                isError: true,
            });
        });
    });
    describe("mergeArrays", () => {
        it("should merge arrays without duplicates", () => {
            const result = mergeArrays([1, 2, 3], [3, 4, 5]);
            expect(result).toEqual([1, 2, 3, 4, 5]);
        });
        it("should handle empty arrays", () => {
            expect(mergeArrays([], [1, 2])).toEqual([1, 2]);
            expect(mergeArrays([1, 2], [])).toEqual([1, 2]);
            expect(mergeArrays([], [])).toEqual([]);
        });
        it("should handle undefined arrays", () => {
            expect(mergeArrays(undefined, [1, 2])).toEqual([1, 2]);
            expect(mergeArrays([1, 2], undefined)).toEqual([1, 2]);
            expect(mergeArrays(undefined, undefined)).toEqual([]);
        });
    });
    describe("generatePermissions", () => {
        it("should generate permission names from tool definitions", () => {
            const tools = [
                {
                    name: "test_tool",
                    description: "Test tool",
                    schema: z.object({}),
                    execute: () => "result",
                },
                {
                    name: "another_tool",
                    description: "Another tool",
                    schema: z.object({}),
                    execute: () => "result",
                },
            ];
            const permissions = generatePermissions("myserver", tools);
            expect(permissions).toEqual([
                "mcp__myserver__test_tool",
                "mcp__myserver__another_tool",
            ]);
        });
        it("should handle empty tools array", () => {
            const permissions = generatePermissions("myserver", []);
            expect(permissions).toEqual([]);
        });
    });
    describe("BaseMcpServer", () => {
        it("should create server with options", () => {
            const server = new BaseMcpServer({
                name: "test-server",
                version: "1.0.0",
                description: "Test server",
            });
            expect(server).toBeDefined();
            expect(server.getServer()).toBeDefined();
        });
        it("should set default root", () => {
            const server = new BaseMcpServer({
                name: "test-server",
                version: "1.0.0",
            });
            server.setDefaultRoot("/test/root");
            // Default root is stored privately, we'll test its effect in registerTool
        });
        it("should register a tool", () => {
            const server = new BaseMcpServer({
                name: "test-server",
                version: "1.0.0",
            });
            const tool = {
                name: "test_tool",
                description: "Test tool",
                schema: z.object({ input: z.string() }),
                execute: (args) => `Received: ${args.input}`,
            };
            server.registerTool(tool);
            // Tool is registered internally
        });
        it("should register multiple tools", () => {
            const server = new BaseMcpServer({
                name: "test-server",
                version: "1.0.0",
            });
            const tools = [
                {
                    name: "tool1",
                    description: "Tool 1",
                    schema: z.object({ x: z.number() }),
                    execute: (args) => `x: ${args.x}`,
                },
                {
                    name: "tool2",
                    description: "Tool 2",
                    schema: z.object({ y: z.string() }),
                    execute: (args) => `y: ${args.y}`,
                },
            ];
            server.registerTools(tools);
            // Tools are registered internally
        });
        it("should register tool with default root", () => {
            const server = new BaseMcpServer({
                name: "test-server",
                version: "1.0.0",
            });
            server.setDefaultRoot("/default/root");
            const tool = {
                name: "root_tool",
                description: "Tool with root parameter",
                schema: z.object({
                    root: z.string().optional(),
                    file: z.string()
                }),
                execute: (args) => {
                    // Test that args are passed correctly
                    expect(args).toBeDefined();
                    return `File: ${args.file} in ${args.root}`;
                },
            };
            server.registerTool(tool);
            // Since we can't directly test the wrapped handler without starting the server,
            // we'll rely on the fact that the tool is registered
        });
        it("should handle non-ZodObject schemas", () => {
            const server = new BaseMcpServer({
                name: "test-server",
                version: "1.0.0",
            });
            const tool = {
                name: "string_tool",
                description: "Tool with string schema",
                schema: z.string(),
                execute: (args) => `Received: ${args}`,
            };
            server.registerTool(tool);
            // Tool is registered with non-object schema
        });
    });
    describe("createTool", () => {
        it("should return the tool definition as-is", () => {
            const tool = {
                name: "my_tool",
                description: "My tool",
                schema: z.object({ value: z.number() }),
                execute: (args) => `Value: ${args.value}`,
            };
            const result = createTool(tool);
            expect(result).toBe(tool);
        });
    });
    describe("readJsonFile", () => {
        it("should return null for non-existent file", () => {
            const result = readJsonFile("/non/existent/file.json");
            expect(result).toBe(null);
        });
    });
    // writeJsonFile and initializeMcpConfig tests would require fs mocking
}
