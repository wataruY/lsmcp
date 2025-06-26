// This file contains intentional errors for testing diagnostics

fn type_error_example() {
    let number: i32 = "not a number";  // Type error
}

fn undefined_variable() {
    println!("{}", undefined_var);  // Undefined variable
}

fn missing_semicolon() {
    let x = 5  // Missing semicolon
    let y = 10;
}

fn unused_variable() {
    let unused = 42;  // Warning: unused variable
}

// Missing return type
fn missing_return() -> i32 {
    // Function should return i32 but doesn't
}