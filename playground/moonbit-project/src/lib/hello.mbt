pub fn hello() -> String {
  "Hello, Moonbit!"
}

pub fn add(x: Int, y: Int) -> Int {
  x + y
}

pub struct User {
  name: String
  age: Int
} derive(Show)

pub fn create_user(name: String, age: Int) -> User {
  { name, age }
}