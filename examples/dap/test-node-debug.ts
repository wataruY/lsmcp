#!/usr/bin/env node
// @ts-nocheck
/**
 * Test program for Node.js DAP adapter
 */

// Simple test program with various debugging scenarios
function fibonacci(n: number): number {
  if (n <= 1) {
    return n;
  }
  return fibonacci(n - 1) + fibonacci(n - 2);
}

function testVariables() {
  const str = "Hello, World!";
  const num = 42;
  const bool = true;
  const arr = [1, 2, 3, 4, 5];
  const obj = {
    name: "Test Object",
    value: 123,
    nested: {
      prop: "nested value"
    }
  };
  
  console.log("String:", str);
  console.log("Number:", num);
  console.log("Boolean:", bool);
  console.log("Array:", arr);
  console.log("Object:", obj);
  
  return obj;
}

async function testAsync() {
  console.log("Starting async operation...");
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log("Async operation completed!");
  
  return "async result";
}

function main() {
  console.log("Debug test program started");
  
  // Test breakpoint here
  const result = testVariables();
  console.log("Variables test completed");
  
  // Test stepping through fibonacci
  const fib10 = fibonacci(10);
  console.log(`Fibonacci(10) = ${fib10}`);
  
  // Test async/await
  testAsync().then(result => {
    console.log("Async result:", result);
    console.log("Program finished");
  });
}

// Run the program
main();