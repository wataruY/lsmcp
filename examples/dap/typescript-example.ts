// @ts-nocheck
// TypeScript debugging example using ts-blank-space

interface User {
  name: string;
  age: number;
  email?: string;
}

function greetUser(user: User): string {
  const greeting = `Hello, ${user.name}!`;
  console.log(greeting);
  return greeting;
}

function processUsers(users: User[]): void {
  console.log(`Processing ${users.length} users...`);
  
  for (const user of users) {
    const message = greetUser(user);
    
    if (user.age >= 18) {
      console.log(`${user.name} is an adult`);
    } else {
      console.log(`${user.name} is a minor`);
    }
  }
  
  console.log("Processing complete!");
}

// Test data
const testUsers: User[] = [
  { name: "Alice", age: 25, email: "alice@example.com" },
  { name: "Bob", age: 17 },
  { name: "Charlie", age: 30, email: "charlie@example.com" }
];

// Entry point
console.log("=== TypeScript Debug Example ===");
processUsers(testUsers);
console.log("=== Done ===");