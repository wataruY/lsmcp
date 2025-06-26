/// A simple calculator struct
pub struct Calculator {
    value: f64,
}

impl Calculator {
    /// Creates a new Calculator with initial value
    pub fn new() -> Self {
        Calculator { value: 0.0 }
    }

    /// Adds a number to the current value
    pub fn add(&mut self, num: f64) -> &mut Self {
        self.value += num;
        self
    }

    /// Subtracts a number from the current value
    pub fn subtract(&mut self, num: f64) -> &mut Self {
        self.value -= num;
        self
    }

    /// Gets the current value
    pub fn get_value(&self) -> f64 {
        self.value
    }
}

/// Example function to demonstrate refactoring
pub fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculator() {
        let mut calc = Calculator::new();
        calc.add(5.0).subtract(2.0);
        assert_eq!(calc.get_value(), 3.0);
    }

    #[test]
    fn test_greet() {
        assert_eq!(greet("World"), "Hello, World!");
    }
}