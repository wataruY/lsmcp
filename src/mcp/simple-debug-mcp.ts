#!/usr/bin/env node
/**
 * Simple Debug MCP Server - 実用的なデバッグツール
 */

import { z } from "zod";
import { BaseMcpServer, ToolDef } from "./_mcplib.ts";

// 値の履歴を保持
const valueHistory = new Map<string, any[]>();

// ツール定義
const trackValueTool: ToolDef<z.ZodType> = {
  name: "track_value",
  description: "Track and log value changes",
  schema: z.object({
    name: z.string().describe("Variable name to track"),
    value: z.any().describe("Current value"),
    label: z.string().optional().describe("Optional label for this tracking point"),
  }),
  execute: async (args) => {
    const { name, value, label } = args;
    
    // 履歴に追加
    if (!valueHistory.has(name)) {
      valueHistory.set(name, []);
    }
    valueHistory.get(name)!.push({ value, timestamp: new Date(), label });
    
    const output = label 
      ? `[${label}] ${name} = ${JSON.stringify(value)}`
      : `${name} = ${JSON.stringify(value)}`;
    
    console.error(`[TRACK] ${output}`);
    return output;
  }
};

const getValueHistoryTool: ToolDef<z.ZodType> = {
  name: "get_value_history",
  description: "Get the history of tracked values",
  schema: z.object({
    name: z.string().describe("Variable name to get history for"),
  }),
  execute: async (args) => {
    const history = valueHistory.get(args.name) || [];
    return JSON.stringify(history.map((h, i) => ({
      index: i,
      value: h.value,
      timestamp: h.timestamp,
      label: h.label
    })), null, 2);
  }
};

const compareValuesTool: ToolDef<z.ZodType> = {
  name: "compare_values",
  description: "Compare two values and show differences",
  schema: z.object({
    label1: z.string().describe("Label for first value"),
    value1: z.any().describe("First value"),
    label2: z.string().describe("Label for second value"),
    value2: z.any().describe("Second value"),
  }),
  execute: async (args) => {
    const { label1, value1, label2, value2 } = args;
    
    const result = [
      `Comparing values:`,
      `${label1}: ${JSON.stringify(value1)}`,
      `${label2}: ${JSON.stringify(value2)}`,
      ``,
      `Equal: ${JSON.stringify(value1) === JSON.stringify(value2)}`,
      `Type match: ${typeof value1 === typeof value2}`
    ];
    
    console.error(`[COMPARE] ${result.join('\n')}`);
    return result.join('\n');
  }
};

const measureTimeTool: ToolDef<z.ZodType> = {
  name: "measure_time",
  description: "Measure execution time between checkpoints",
  schema: z.object({
    checkpoint: z.string().describe("Checkpoint name"),
    action: z.enum(["start", "end"]).describe("Start or end timing"),
  }),
  execute: async (args) => {
    const { checkpoint, action } = args;
    const key = `time_${checkpoint}`;
    
    if (action === "start") {
      (global as any)[key] = performance.now();
      return `Started timing: ${checkpoint}`;
    } else {
      const start = (global as any)[key];
      if (!start) {
        return `No start time found for: ${checkpoint}`;
      }
      const duration = performance.now() - start;
      delete (global as any)[key];
      
      const result = `${checkpoint}: ${duration.toFixed(2)}ms`;
      console.error(`[TIME] ${result}`);
      return result;
    }
  }
};

const clearHistoryTool: ToolDef<z.ZodType> = {
  name: "clear_history",
  description: "Clear all tracked value history",
  schema: z.object({}),
  execute: async () => {
    valueHistory.clear();
    return "Value history cleared";
  }
};

// MCPサーバーを作成
class SimpleDebugMcpServer extends BaseMcpServer {
  constructor() {
    super({
      name: "simple-debug-mcp",
      version: "1.0.0",
      description: "Simple debugging tools for value tracking"
    });
    
    // ツールを登録
    this.registerTool(trackValueTool);
    this.registerTool(getValueHistoryTool);
    this.registerTool(compareValuesTool);
    this.registerTool(measureTimeTool);
    this.registerTool(clearHistoryTool);
  }
}

// サーバーを起動
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new SimpleDebugMcpServer();
  server.start().catch(console.error);
}