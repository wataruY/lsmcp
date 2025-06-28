/**
 * Example: Using DAP MCP with Node.js
 * 
 * This demonstrates how to debug a Node.js program using the DAP MCP server.
 * Run this file with: node examples/dap/test-node-debug.js
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";

async function debugNodeProgram() {
  // Start the DAP MCP server
  const dapProcess = spawn("node", ["dist/dap-mcp.js"], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/dap-mcp.js"],
  });

  const client = new Client({
    name: "dap-test-client",
    version: "1.0.0",
  }, {
    capabilities: {}
  });

  await client.connect(transport);

  try {
    // Launch a Node.js debug session
    console.log("Launching Node.js debug session...");
    const launchResult = await client.callTool({
      name: "debug_launch",
      arguments: {
        sessionId: "node-debug-1",
        adapter: "node",  // This will use our custom Node.js adapter
        program: "./test-node-dap.js",
        stopOnEntry: true,
      }
    });
    console.log("Launch result:", launchResult.content[0]?.text);

    // Set breakpoints
    console.log("\nSetting breakpoints...");
    const bpResult = await client.callTool({
      name: "debug_set_breakpoints",
      arguments: {
        sessionId: "node-debug-1",
        source: "./test-node-dap.js",
        lines: [12, 15],
      }
    });
    console.log("Breakpoints result:", bpResult.content[0]?.text);

    // Continue execution
    console.log("\nContinuing execution...");
    const continueResult = await client.callTool({
      name: "debug_continue",
      arguments: {
        sessionId: "node-debug-1",
      }
    });
    console.log("Continue result:", continueResult.content[0]?.text);

    // Wait a bit for the program to hit a breakpoint
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get stack trace
    console.log("\nGetting stack trace...");
    const stackResult = await client.callTool({
      name: "debug_get_stack_trace",
      arguments: {
        sessionId: "node-debug-1",
      }
    });
    console.log("Stack trace:", stackResult.content[0]?.text);

    // Get variables
    console.log("\nGetting variables...");
    const varsResult = await client.callTool({
      name: "debug_get_variables",
      arguments: {
        sessionId: "node-debug-1",
      }
    });
    console.log("Variables:", varsResult.content[0]?.text);

    // Evaluate an expression
    console.log("\nEvaluating expression...");
    const evalResult = await client.callTool({
      name: "debug_evaluate",
      arguments: {
        sessionId: "node-debug-1",
        expression: "2 + 2",
      }
    });
    console.log("Evaluation result:", evalResult.content[0]?.text);

    // Step over
    console.log("\nStepping over...");
    const stepResult = await client.callTool({
      name: "debug_step_over",
      arguments: {
        sessionId: "node-debug-1",
      }
    });
    console.log("Step result:", stepResult.content[0]?.text);

    // Continue to finish
    console.log("\nContinuing to finish...");
    await client.callTool({
      name: "debug_continue",
      arguments: {
        sessionId: "node-debug-1",
      }
    });

    // Wait for program to finish
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Disconnect
    console.log("\nDisconnecting...");
    const disconnectResult = await client.callTool({
      name: "debug_disconnect",
      arguments: {
        sessionId: "node-debug-1",
      }
    });
    console.log("Disconnect result:", disconnectResult.content[0]?.text);

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.close();
    dapProcess.kill();
  }
}

// Run the example
debugNodeProgram().catch(console.error);