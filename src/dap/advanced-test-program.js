
// Test program for advanced DAP features
const globalVar = "I'm global";

function calculateSum(arr) {
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];  // Breakpoint here
  }
  return sum;
}

function complexFunction() {
  const localVar = "I'm local";
  const numbers = [1, 2, 3, 4, 5];
  const obj = {
    name: "Test Object",
    value: 42,
    nested: {
      deep: "Deep value"
    }
  };
  
  console.log("Before calculation");
  const result = calculateSum(numbers); // Breakpoint here
  console.log("Sum is:", result);
  
  return { result, obj };
}

// Main execution
console.log("Starting advanced debug test...");
const output = complexFunction();
console.log("Finished with output:", output);
