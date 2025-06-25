# Moonbit MCP Usage Example

## Setup

1. Install moon (Moonbit toolchain):
```bash
# Follow instructions at https://www.moonbitlang.com/download
```

2. Create a Moonbit project:
```bash
mkdir my-moonbit-project
cd my-moonbit-project
moon new
```

3. Initialize Moonbit MCP:
```bash
npx moonbit-mcp --init=claude
```

4. Start Claude:
```bash
claude
```

## Example Usage in Claude

### Get type information:
```
Use moonbit_get_hover to show the type of the `hello` function in src/lib/hello.mbt at line 1
```

### Find references:
```
Use moonbit_find_references to find all uses of the `User` struct in the project
```

### Check for errors:
```
Use moonbit_get_diagnostics on src/main/main.mbt to check for any compilation errors
```

### Rename a symbol:
```
Use moonbit_rename_symbol to rename the function `add` to `sum` in src/lib/hello.mbt
```

### Get document symbols:
```
Use moonbit_get_document_symbols to list all functions and types in src/lib/hello.mbt
```

## Sample Moonbit Code

Create `src/lib/math.mbt`:
```moonbit
pub fn factorial(n: Int) -> Int {
  if n <= 1 {
    1
  } else {
    n * factorial(n - 1)
  }
}

pub fn fibonacci(n: Int) -> Int {
  match n {
    0 => 0
    1 => 1
    _ => fibonacci(n - 1) + fibonacci(n - 2)
  }
}

pub struct Point {
  x: Double
  y: Double
} derive(Show, Eq)

pub fn distance(p1: Point, p2: Point) -> Double {
  let dx = p1.x - p2.x
  let dy = p1.y - p2.y
  (dx * dx + dy * dy).sqrt()
}
```

Then you can ask Claude:
- "Show me the type signature of the fibonacci function"
- "Find all references to the Point struct"
- "Rename the distance function to calculate_distance"
- "Check if there are any type errors in this file"