# Rust MCP Usage Example

## Setup

1. Install Rust and rust-analyzer:
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install rust-analyzer
rustup component add rust-analyzer
```

2. Create a Rust project:
```bash
cargo new my-rust-project
cd my-rust-project
```

3. Initialize Rust MCP:
```bash
npx rust-mcp --init=claude
```

4. Start Claude:
```bash
claude
```

## Example Usage in Claude

### Get type information:
```
Use rust_get_hover to show the type of the `main` function in src/main.rs
```

### Find references:
```
Use rust_find_references to find all uses of the `Config` struct across the project
```

### Check for errors:
```
Use rust_get_diagnostics on src/main.rs to check for any compilation errors
```

### Rename a symbol:
```
Use rust_rename_symbol to rename the struct `User` to `Person` in src/lib.rs
```

### Get workspace symbols:
```
Use rust_get_workspace_symbols to search for all functions containing "parse" in their name
```

## Sample Rust Code

Create `src/lib.rs`:
```rust
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub settings: HashMap<String, String>,
}

impl Config {
    pub fn new(host: &str, port: u16) -> Self {
        Self {
            host: host.to_string(),
            port,
            settings: HashMap::new(),
        }
    }

    pub fn get_setting(&self, key: &str) -> Option<&String> {
        self.settings.get(key)
    }

    pub fn set_setting(&mut self, key: String, value: String) {
        self.settings.insert(key, value);
    }
}

#[derive(Debug)]
pub enum Error {
    ConfigError(String),
    NetworkError(String),
    ParseError(String),
}

pub fn parse_config(input: &str) -> Result<Config, Error> {
    // Simple parser implementation
    let parts: Vec<&str> = input.split(':').collect();
    if parts.len() != 2 {
        return Err(Error::ParseError("Invalid format".to_string()));
    }
    
    let port = parts[1].parse::<u16>()
        .map_err(|_| Error::ParseError("Invalid port".to_string()))?;
    
    Ok(Config::new(parts[0], port))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_config() {
        let config = parse_config("localhost:8080").unwrap();
        assert_eq!(config.host, "localhost");
        assert_eq!(config.port, 8080);
    }
}
```

Then you can ask Claude:
- "Show me all the methods of the Config struct"
- "Find all places where Error enum is used"
- "Rename the parse_config function to parse_connection_string"
- "Check for any lifetime or borrowing errors"
- "Show me the signature help for Config::new"