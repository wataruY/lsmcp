#!/usr/bin/env node

let count = 0;
console.log("count initial:", count);

count = 1;
console.log("count after first change:", count);

count = count + 5;
console.log("count after addition:", count);

for (let i = 0; i < 3; i++) {
    count = count + i;
    console.log(`count in loop ${i}:`, count);
}

console.log("count final:", count);