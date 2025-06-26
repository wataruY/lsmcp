fn main {
  let message = @lib.hello()
  println(message)
  
  let result = @lib.add(10, 20)
  println("10 + 20 = " + result.to_string())
  
  let user = @lib.create_user("Alice", 25)
  println("User: " + user.name + ", Age: " + user.age.to_string())
}