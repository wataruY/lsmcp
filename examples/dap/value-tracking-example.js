// Test program that tracks variable changes
let count = 0;
let message = "initial";

console.log("[VAR] count = " + JSON.stringify(count));
console.log("[VAR] message = " + JSON.stringify(message));

for (let i = 0; i < 5; i++) {
  count += i;
  message = `iteration ${i}`;
  
  console.log(`\nLoop ${i}:`);
  console.log("[VAR] count = " + JSON.stringify(count));
  console.log("[VAR] message = " + JSON.stringify(message));
}

console.log("\nFinal values:");
console.log("[VAR] count = " + JSON.stringify(count));
console.log("[VAR] message = " + JSON.stringify(message));