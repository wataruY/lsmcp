// Test case 1: Simple variable renaming
const bar = 1;
console.log(bar);
const result = bar + 2;
export { bar };

// Test case 2: Function renaming
function bar2(x: number): number {
  return x * 2;
}

const value = bar2(5);
console.log(bar2(10));

export { bar2 };

// Test case 3: Class renaming
class Bar3 {
  private value: number;
  
  constructor(value: number) {
    this.value = value;
  }
  
  getValue(): number {
    return this.value;
  }
}

const instance = new Bar3(42);
console.log(instance.getValue());

export { Bar3 };