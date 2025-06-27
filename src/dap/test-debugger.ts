import { DAPClient } from "./dapClient.ts";
import { resolve } from "path";

async function testDebugger() {
  const client = new DAPClient();

  // Listen for events
  client.on("initialized", () => {
    console.log("✅ Initialized event received");
  });

  client.on("stopped", (event) => {
    console.log("⏸️  Stopped:", event);
  });

  client.on("output", (event) => {
    console.log(`📝 Output [${event.category}]:`, event.output);
  });

  client.on("terminated", () => {
    console.log("🛑 Terminated");
  });

  try {
    // Connect to Node.js debugger
    console.log("🔌 Connecting to Node.js debugger...");
    await client.connect("node", [
      resolve(process.execPath, "../../lib/node_modules/node-debug2/out/src/nodeDebug.js"),
    ]);

    // Initialize
    console.log("🚀 Initializing...");
    const initResponse = await client.initialize();
    console.log("✅ Initialize response:", initResponse);

    // Send initialized event
    await new Promise((resolve) => {
      client.once("initialized", resolve);
      // Configuration done
      client.sendRequest("configurationDone").catch(() => {});
    });

    // Create a simple test program
    const testProgram = resolve(import.meta.dirname!, "test-program.js");
    const { writeFileSync } = await import("fs");
    writeFileSync(
      testProgram,
      `
console.log('Starting program...');

function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

for (let i = 0; i < 5; i++) {
  console.log(\`fibonacci(\${i}) = \${fibonacci(i)}\`);
}

console.log('Program finished!');
    `
    );

    // Set breakpoints
    console.log("🔴 Setting breakpoints...");
    const breakpointsResponse = await client.sendRequest("setBreakpoints", {
      source: { path: testProgram },
      breakpoints: [{ line: 5 }, { line: 10 }],
    });
    console.log("✅ Breakpoints response:", breakpointsResponse);

    // Launch the program
    console.log("🚀 Launching program...");
    const launchResponse = await client.sendRequest("launch", {
      program: testProgram,
      stopOnEntry: true,
      console: "internalConsole",
      outputCapture: "std",
    });
    console.log("✅ Launch response:", launchResponse);

    // Wait a bit for events
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Get threads
    console.log("🧵 Getting threads...");
    const threadsResponse = await client.sendRequest("threads");
    console.log("✅ Threads:", threadsResponse);

    // Continue execution
    if (threadsResponse.threads && threadsResponse.threads.length > 0) {
      const threadId = threadsResponse.threads[0].id;
      console.log("▶️  Continuing execution...");
      await client.sendRequest("continue", { threadId });
    }

    // Wait for program to finish
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Disconnect
    console.log("🔌 Disconnecting...");
    await client.sendRequest("disconnect", { terminateDebuggee: true });
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    client.disconnect();
  }
}

// Run the test
testDebugger().catch(console.error);