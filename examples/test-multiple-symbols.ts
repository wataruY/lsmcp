// Test file for multiple symbol occurrences on the same line
const foo = 1, bar = foo; // Two occurrences of 'foo' on the same line
const baz = foo + bar;
export { foo, bar, baz };