#!/usr/bin/env -S npx tsx
import { DAPClient } from "./dapClient.ts";
import { writeFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Removed unused function

async function testWithVSCodeJsDebug() {
  const client = new DAPClient();

  // Create test program
  const testProgram = resolve(__dirname, "test-program.js");
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

  // Set up event listeners
  client.on("initialized", () => {
    console.log("✅ Initialized event received");
  });

  client.on("stopped", (event) => {
    console.log("⏸️  Stopped:", event);
  });

  client.on("output", (event) => {
    console.log(`📝 Output [${event.category}]:`, event.output.trim());
  });

  client.on("terminated", () => {
    console.log("🛑 Terminated");
  });

  try {
    // Try to use the globally installed js-debug-dap
    console.log("🔌 Connecting to js-debug-dap...");
    await client.connect("npx", ["@vscode/js-debug-dap", "--"]);

    // Initialize
    console.log("🚀 Initializing...");
    const initResponse = await client.initialize({
      clientID: "dap-test",
      clientName: "DAP Test",
      adapterID: "pwa-node",
      locale: "en",
      linesStartAt1: true,
      columnsStartAt1: true,
      pathFormat: "path",
    });
    console.log("✅ Capabilities:", JSON.stringify(initResponse, null, 2));

    // Wait for initialized event
    await new Promise<void>((resolve) => {
      client.once("initialized", () => resolve());
      setTimeout(() => resolve(), 1000); // Timeout fallback
    });

    // Set breakpoints
    console.log("🔴 Setting breakpoints...");
    try {
      const breakpointsResponse = await client.sendRequest("setBreakpoints", {
        source: { path: testProgram },
        breakpoints: [{ line: 5 }, { line: 10 }],
      });
      console.log("✅ Breakpoints set:", breakpointsResponse);
    } catch (error) {
      console.log("⚠️  Could not set breakpoints:", error);
    }

    // Configuration done
    console.log("✅ Sending configurationDone...");
    await client.sendRequest("configurationDone");

    // Launch
    console.log("🚀 Launching program...");
    await client.sendRequest("launch", {
      type: "pwa-node",
      request: "launch",
      name: "Test Program",
      program: testProgram,
      cwd: __dirname,
      console: "internalConsole",
      outputCapture: "std",
      stopOnEntry: false,
    });
    console.log("✅ Launched");

    // Wait for output
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Get threads
    try {
      const threads = await client.sendRequest("threads");
      console.log("🧵 Threads:", threads);
    } catch (error) {
      console.log("⚠️  Could not get threads:", error);
    }

    // Wait a bit more
    await new Promise((resolve) => setTimeout(resolve, 1000));

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
testWithVSCodeJsDebug().catch(console.error);