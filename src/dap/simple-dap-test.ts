#!/usr/bin/env -S npx tsx
import { writeFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Create a simple test program
const testProgram = resolve(__dirname, "test-program.js");
writeFileSync(
  testProgram,
  `
console.log('Starting program...');

function fibonacci(n) {
  debugger; // This will trigger a breakpoint
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

for (let i = 0; i < 5; i++) {
  console.log(\`fibonacci(\${i}) = \${fibonacci(i)}\`);
}

console.log('Program finished!');
`
);

// First, let's try a simpler approach using Node.js built-in inspector
import { spawn } from "child_process";

console.log("🚀 Starting Node.js with inspector protocol...");
const nodeProcess = spawn("node", ["--inspect-brk=9229", testProgram], {
  stdio: "inherit",
});

nodeProcess.on("error", (err) => {
  console.error("Failed to start process:", err);
});

nodeProcess.on("exit", (code) => {
  console.log(`Process exited with code ${code}`);
});

// Give the debugger time to start
setTimeout(() => {
  console.log("\n✨ Node.js debugger is running on port 9229");
  console.log("You can connect with Chrome DevTools or any DAP client");
  console.log("Press Ctrl+C to stop");
}, 1000);