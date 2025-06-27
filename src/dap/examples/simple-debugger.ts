#!/usr/bin/env -S npx tsx
/**
 * Simple example of using the DAP client library
 */

import { createDebugSession } from "../index.ts";
import { writeFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Create a test program
const testProgram = resolve(__dirname, "test-program.js");
writeFileSync(
  testProgram,
  `
console.log('Starting program...');

function add(a, b) {
  return a + b;  // Set breakpoint here
}

const result = add(5, 3);
console.log('Result:', result);
console.log('Done!');
`
);

async function runDebugger() {
  // Create debug session
  const session = createDebugSession({
    adapter: "node",
    clientID: "simple-debugger",
    clientName: "Simple Debugger Example",
  });

  // Handle events
  session.on("initialized", () => {
    console.log("✅ Debug session initialized");
  });

  session.on("stopped", async (event) => {
    console.log(`⏸️  Stopped: ${event.reason}`);
    
    try {
      // Get stack trace
      const frames = await session.getStackTrace();
      console.log(`📍 Location: ${frames[0].name} at line ${frames[0].line}`);
      
      // Get local variables
      const scopes = await session.getScopes();
      const locals = scopes.find(s => s.name === "Locals");
      
      if (locals) {
        const vars = await session.getVariables(locals.variablesReference);
        console.log("📦 Local variables:");
        vars.forEach(v => console.log(`   ${v.name} = ${v.value}`));
      }
      
      // Evaluate expression
      const sum = await session.evaluate("a + b");
      console.log(`🧮 a + b = ${sum}`);
      
      // Continue
      console.log("▶️  Continuing...");
      await session.continue();
    } catch (error) {
      console.error("Error during debugging:", error);
    }
  });

  session.on("output", (event) => {
    console.log(`📝 [${event.category}] ${event.output.trim()}`);
  });

  session.on("terminated", () => {
    console.log("🛑 Program terminated");
  });

  try {
    // Connect to debug adapter
    console.log("🔌 Connecting to debug adapter...");
    await session.connect();
    
    // Set breakpoint
    console.log("🔴 Setting breakpoint at line 5...");
    await session.setBreakpoints(testProgram, [5]);
    
    // Launch program
    console.log("🚀 Launching program...");
    await session.launch(testProgram);
    
    // Wait for termination
    await new Promise<void>((resolve) => {
      session.on("terminated", resolve);
    });
    
    // Disconnect
    await session.disconnect();
    console.log("✅ Debug session completed!");
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

// Run the example
console.log("Simple DAP Debugger Example");
console.log("===========================\n");

runDebugger().catch(console.error);