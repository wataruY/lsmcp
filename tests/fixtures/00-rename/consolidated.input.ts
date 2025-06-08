// Test case 1: Simple variable renaming
const foo = 1;
console.log(foo);
const result = foo + 2;
export { foo };

// Test case 2: Function renaming
function foo2(x: number): number {
  return x * 2;
}

const value = foo2(5);
console.log(foo2(10));

export { foo2 };

// Test case 3: Class renaming
class Foo3 {
  private value: number;
  
  constructor(value: number) {
    this.value = value;
  }
  
  getValue(): number {
    return this.value;
  }
}

const instance = new Foo3(42);
console.log(instance.getValue());

export { Foo3 };