// This file contains intentional errors for testing diagnostics

fn test_type_error() {
  let x: String = 42  // Type error: Int cannot be assigned to String
  println(x)
}

fn test_undefined_variable() {
  println(undefined_var)  // Error: undefined variable
}

fn test_wrong_arity() {
  let result = add(1)  // Error: wrong number of arguments
  println(result)
}

fn test_missing_return() -> Int {
  println("forgot to return")
  // Error: missing return value
}

pub fn test_unused_function() {
  // Warning: unused function
  let unused = 42
}