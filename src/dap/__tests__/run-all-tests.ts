#!/usr/bin/env -S npx tsx
/**
 * Run all DAP tests in sequence
 */
import { spawn } from "child_process";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const tests = [
  {
    name: "Basic Connection",
    file: "basic-connection.test.ts",
    description: "Tests client-server connection and basic message exchange"
  },
  {
    name: "Variable Inspection",
    file: "variable-inspection.test.ts",
    description: "Tests variable scopes, nested objects, and type information"
  },
  {
    name: "Code Evaluation",
    file: "code-evaluation.test.ts",
    description: "Tests expression evaluation in debug context"
  },
  {
    name: "Step Execution",
    file: "step-execution.test.ts",
    description: "Tests step over, step into, step out operations"
  },
  {
    name: "Full Features",
    file: "full-debugging-features.test.ts",
    description: "Comprehensive test of all debugging capabilities"
  }
];

async function runTest(testFile: string): Promise<boolean> {
  return new Promise((resolve) => {
    const testPath = resolve(__dirname, testFile);
    const proc = spawn("npx", ["tsx", testPath], {
      stdio: "inherit",
    });

    proc.on("exit", (code) => {
      resolve(code === 0);
    });

    proc.on("error", (err) => {
      console.error(`Failed to run ${testFile}:`, err);
      resolve(false);
    });
  });
}

async function runAllTests() {
  console.log("🧪 DAP Test Suite");
  console.log("================\n");
  console.log("⚠️  Make sure enhanced-mock-dap-server.ts is running on port 58080!");
  console.log("   Run: npx tsx src/dap/__tests__/enhanced-mock-dap-server.ts\n");
  
  console.log("Available tests:");
  tests.forEach((test, i) => {
    console.log(`${i + 1}. ${test.name}`);
    console.log(`   ${test.description}`);
  });
  
  console.log("\nPress Enter to start tests or Ctrl+C to cancel...");
  
  await new Promise<void>((resolve) => {
    process.stdin.once("data", () => resolve());
  });

  const results: { name: string; passed: boolean }[] = [];

  for (const test of tests) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Running: ${test.name}`);
    console.log(`${"=".repeat(60)}\n`);
    
    const passed = await runTest(test.file);
    results.push({ name: test.name, passed });
    
    if (!passed) {
      console.log(`\n❌ ${test.name} failed!`);
      break;
    }
    
    // Wait between tests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("Test Results Summary");
  console.log(`${"=".repeat(60)}\n`);
  
  let passedCount = 0;
  results.forEach((result) => {
    console.log(`${result.passed ? "✅" : "❌"} ${result.name}`);
    if (result.passed) passedCount++;
  });
  
  console.log(`\nTotal: ${passedCount}/${results.length} tests passed`);
  
  process.exit(passedCount === results.length ? 0 : 1);
}

if (require.main === module) {
  runAllTests().catch(console.error);
}