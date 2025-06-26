use rust_project::{Calculator, greet};

fn main() {
    // Example with type error (uncomment to test diagnostics)
    // let foo: i32 = "xx";
    
    // Using the Calculator
    let mut calc = Calculator::new();
    calc.add(10.0).subtract(3.0);
    println!("Calculator result: {}", calc.get_value());
    
    // Using the greet function
    let message = greet("Rust MCP");
    println!("{}", message);
}
