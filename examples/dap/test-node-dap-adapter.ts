#!/usr/bin/env node
/**
 * Test script for Node.js DAP adapter
 */

import { createDebugSession } from "../../src/dap/index.ts";
import * as path from "path";

async function testNodeDAPAdapter() {
  console.log("Testing Node.js DAP adapter...");
  
  // Create a debug session using the Node.js DAP adapter
  const session = createDebugSession({
    adapter: path.join(__dirname, "../../src/dap/adapters/node-dap-adapter.ts"),
    adapterArgs: [],
    clientID: "test-node-dap",
    clientName: "Node DAP Test Client",
  });
  
  // Set up event handlers
  session.on("stopped", (event) => {
    console.log("🛑 Stopped:", event.reason, "at thread", event.threadId);
    
    // When stopped, get stack trace and variables
    handleStopped(session, event.threadId || 1);
  });
  
  session.on("output", (event) => {
    const prefix = event.category === "stdout" ? "📤" : "📥";
    process.stdout.write(`${prefix} [${event.category}] ${event.output}`);
  });
  
  session.on("terminated", () => {
    console.log("✅ Program terminated");
  });
  
  session.on("initialized", () => {
    console.log("✅ Debug adapter initialized");
  });
  
  try {
    // Connect to the adapter
    await session.connect();
    console.log("✅ Connected to debug adapter");
    
    // Set breakpoints
    const testProgram = path.join(__dirname, "test-node-debug.ts");
    await session.setBreakpoints(testProgram, [40, 48]); // Lines with comments "Test breakpoint here" and fibonacci call
    console.log("✅ Breakpoints set");
    
    // Launch the program
    await session.launch(testProgram, {
      stopOnEntry: false,
      args: [],
      cwd: __dirname,
    });
    console.log("✅ Program launched");
    
    // Wait for program to finish
    await new Promise(resolve => {
      session.on("terminated", resolve);
    });
    
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await session.disconnect();
    console.log("✅ Disconnected");
  }
}

async function handleStopped(session: any, threadId: number) {
  try {
    // Get stack trace
    const stackFrames = await session.getStackTrace(threadId);
    console.log("\n📚 Stack trace:");
    stackFrames.forEach((frame: any, index: number) => {
      console.log(`  #${index} ${frame.name} at ${frame.source?.path || 'unknown'}:${frame.line}:${frame.column}`);
    });
    
    // Get scopes and variables for the top frame
    if (stackFrames.length > 0) {
      const frameId = stackFrames[0].id;
      const scopes = await session.getScopes(frameId);
      
      console.log("\n🔍 Variables:");
      for (const scope of scopes) {
        console.log(`  ${scope.name}:`);
        const variables = await session.getVariables(scope.variablesReference);
        for (const variable of variables.slice(0, 10)) { // Show first 10 variables
          console.log(`    ${variable.name} = ${variable.value} (${variable.type || 'unknown'})`);
        }
        if (variables.length > 10) {
          console.log(`    ... and ${variables.length - 10} more`);
        }
      }
    }
    
    // Evaluate an expression
    try {
      const result = await session.evaluate("1 + 2 + 3");
      console.log("\n🧮 Evaluation result: '1 + 2 + 3' =", result);
    } catch (error) {
      console.log("\n🧮 Evaluation failed:", error);
    }
    
    // Continue execution
    console.log("\n▶️ Continuing...");
    await session.continue(threadId);
    
  } catch (error) {
    console.error("❌ Error in handleStopped:", error);
  }
}

// Run the test
testNodeDAPAdapter().catch(console.error);