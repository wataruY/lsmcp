// Test file with various TypeScript errors

const x: string = 123; // Type error

function greet(name: string): string {
  return "Hello, " + name;
}

greet(456); // Type error

const unusedVar = 42; // Unused variable

// Missing return statement
function needsReturn(): number {
  console.log("forgot to return");
}