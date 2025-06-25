import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs/promises";
import { randomBytes } from "crypto";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUST_MCP_PATH = path.join(__dirname, "../dist/rust-mcp.js");

describe("Rust MCP Server", () => {
  let client: Client;
  let transport: StdioClientTransport;
  let tmpDir: string;

  beforeEach(async () => {
    // Skip test if rust-mcp.js is not built
    try {
      await fs.access(RUST_MCP_PATH);
    } catch {
      console.log("Skipping test: dist/rust-mcp.js not found. Run 'pnpm build' first.");
      return;
    }

    // Check if rust-analyzer is available
    try {
      execSync("rust-analyzer --version", { stdio: "pipe" });
    } catch {
      console.log("Skipping test: rust-analyzer not found. Install with: rustup component add rust-analyzer");
      return;
    }

    // Create temporary directory
    const hash = randomBytes(8).toString("hex");
    tmpDir = path.join(__dirname, `tmp-rust-${hash}`);
    await fs.mkdir(tmpDir, { recursive: true });

    // Create a minimal Cargo.toml to make it a Rust project
    await fs.writeFile(path.join(tmpDir, "Cargo.toml"), `[package]
name = "test-project"
version = "0.1.0"
edition = "2021"

[dependencies]
`);

    // Create src directory
    await fs.mkdir(path.join(tmpDir, "src"), { recursive: true });

    // Create transport with server parameters
    transport = new StdioClientTransport({
      command: "node",
      args: [RUST_MCP_PATH],
      env: {
        ...process.env,
        PROJECT_ROOT: tmpDir,
      } as Record<string, string>,
    });

    // Create and connect client
    client = new Client({
      name: "test-client",
      version: "1.0.0",
    });

    await client.connect(transport);
  });

  afterEach(async () => {
    // Cleanup
    if (client) {
      await client.close();
    }
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("should list available tools with rust_ prefix", async () => {
    if (!client) return;

    const response = await client.listTools();
    const toolNames = response.tools.map(t => t.name);

    // Check for rust-prefixed tools
    expect(toolNames).toContain("rust_get_hover");
    expect(toolNames).toContain("rust_find_references");
    expect(toolNames).toContain("rust_get_definitions");
    expect(toolNames).toContain("rust_get_diagnostics");
    expect(toolNames).toContain("rust_rename_symbol");
    expect(toolNames).toContain("rust_get_document_symbols");
    expect(toolNames).toContain("rust_get_workspace_symbols");

    // Check that tools have rust prefix
    const rustTools = toolNames.filter(name => name.startsWith("rust_"));
    expect(rustTools.length).toBeGreaterThan(10);
  });

  it("should get hover information for Rust code", async () => {
    if (!client) return;

    // Create a Rust file
    const rustCode = `
fn main() {
    let message = "Hello, World!";
    println!("{}", message);
}
`;
    await fs.writeFile(path.join(tmpDir, "src/main.rs"), rustCode);

    // Get hover information for 'message'
    const result = await client.callTool({
      name: "rust_get_hover",
      arguments: {
        root: tmpDir,
        filePath: "src/main.rs",
        line: 3,
        target: "message",
      },
    });

    expect(result.isError).toBe(false);
    if (!result.isError && result.content[0]?.type === "text") {
      const text = result.content[0].text;
      expect(text).toContain("&str");
    }
  });

  it("should get diagnostics for Rust code with errors", async () => {
    if (!client) return;

    // Create a Rust file with an error
    const rustCode = `
fn main() {
    let x: i32 = "not a number"; // Type error
    println!("{}", x);
}
`;
    await fs.writeFile(path.join(tmpDir, "src/main.rs"), rustCode);

    // Get diagnostics
    const result = await client.callTool({
      name: "rust_get_diagnostics",
      arguments: {
        root: tmpDir,
        filePath: "src/main.rs",
      },
    });

    expect(result.isError).toBe(false);
    if (!result.isError && result.content[0]?.type === "text") {
      const text = result.content[0].text;
      expect(text).toContain("mismatched types");
    }
  });

  it("should get document symbols for Rust code", async () => {
    if (!client) return;

    // Create a Rust file with various symbols
    const rustCode = `
struct Person {
    name: String,
    age: u32,
}

impl Person {
    fn new(name: String, age: u32) -> Self {
        Person { name, age }
    }

    fn greet(&self) {
        println!("Hello, I'm {}", self.name);
    }
}

fn main() {
    let person = Person::new("Alice".to_string(), 30);
    person.greet();
}
`;
    await fs.writeFile(path.join(tmpDir, "src/main.rs"), rustCode);

    // Get document symbols
    const result = await client.callTool({
      name: "rust_get_document_symbols",
      arguments: {
        root: tmpDir,
        filePath: "src/main.rs",
      },
    });

    expect(result.isError).toBe(false);
    if (!result.isError && result.content[0]?.type === "text") {
      const text = result.content[0].text;
      expect(text).toContain("Person");
      expect(text).toContain("new");
      expect(text).toContain("greet");
      expect(text).toContain("main");
    }
  });

  it("should find references in Rust code", async () => {
    if (!client) return;

    // Create multiple Rust files
    const libCode = `
pub fn calculate(x: i32, y: i32) -> i32 {
    x + y
}
`;
    await fs.writeFile(path.join(tmpDir, "src/lib.rs"), libCode);

    const mainCode = `
mod lib;

fn main() {
    let result = lib::calculate(5, 3);
    println!("Result: {}", result);
    
    let another = lib::calculate(10, 20);
    println!("Another: {}", another);
}
`;
    await fs.writeFile(path.join(tmpDir, "src/main.rs"), mainCode);

    // Find references to 'calculate'
    const result = await client.callTool({
      name: "rust_find_references",
      arguments: {
        root: tmpDir,
        filePath: "src/lib.rs",
        line: 2,
        symbolName: "calculate",
      },
    });

    expect(result.isError).toBe(false);
    if (!result.isError && result.content[0]?.type === "text") {
      const text = result.content[0].text;
      expect(text).toContain("Found");
      expect(text).toContain("reference");
    }
  });

  it("should list tools with rust descriptions", async () => {
    if (!client) return;

    const response = await client.callTool({
      name: "list_tools",
      arguments: {
        category: "lsp",
      },
    });

    expect(response.isError).toBe(false);
    if (!response.isError && response.content[0]?.type === "text") {
      const text = response.content[0].text;
      // Should not mention TypeScript in Rust tools
      expect(text).not.toContain("TypeScript");
      // Should have Rust-specific descriptions
      expect(text).toContain("rust_");
    }
  });
});