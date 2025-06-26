"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.definitionContextSchema = exports.symbolLocationWithIndexSchema = exports.symbolLocationSchema = exports.fileLineLocationSchema = exports.fileLocationSchema = exports.commonSchemas = void 0;
const zod_1 = require("zod");
// Common schema shapes used across tools
exports.commonSchemas = {
    root: zod_1.z.string().describe("Root directory for resolving relative paths"),
    filePath: zod_1.z
        .string()
        .describe("File path (relative to root)"),
    line: zod_1.z
        .union([zod_1.z.number(), zod_1.z.string()])
        .describe("Line number (1-based) or string to match in the line"),
    symbolName: zod_1.z.string().describe("Name of the symbol"),
    character: zod_1.z.number().describe("Character position in the line (0-based)"),
    symbolIndex: zod_1.z
        .number()
        .default(0)
        .describe("Index of the symbol occurrence if it appears multiple times on the line (0-based)"),
    before: zod_1.z
        .number()
        .default(0)
        .describe("Number of lines to show before the definition"),
    after: zod_1.z
        .number()
        .default(0)
        .describe("Number of lines to show after the definition"),
};
// Create common schema combinations
exports.fileLocationSchema = zod_1.z.object({
    root: exports.commonSchemas.root,
    filePath: exports.commonSchemas.filePath,
});
exports.fileLineLocationSchema = zod_1.z.object({
    root: exports.commonSchemas.root,
    filePath: exports.commonSchemas.filePath,
    line: exports.commonSchemas.line,
});
exports.symbolLocationSchema = zod_1.z.object({
    root: exports.commonSchemas.root,
    filePath: exports.commonSchemas.filePath,
    line: exports.commonSchemas.line,
    symbolName: exports.commonSchemas.symbolName,
});
exports.symbolLocationWithIndexSchema = zod_1.z.object({
    root: exports.commonSchemas.root,
    filePath: exports.commonSchemas.filePath,
    line: exports.commonSchemas.line,
    symbolName: exports.commonSchemas.symbolName,
    symbolIndex: exports.commonSchemas.symbolIndex,
});
exports.definitionContextSchema = zod_1.z.object({
    root: exports.commonSchemas.root,
    filePath: exports.commonSchemas.filePath,
    line: exports.commonSchemas.line,
    symbolName: exports.commonSchemas.symbolName,
    before: exports.commonSchemas.before,
    after: exports.commonSchemas.after,
});
