import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs/promises";
import { randomBytes } from "crypto";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LSMCP_PATH = path.join(__dirname, "../dist/lsmcp.js");

describe("Python Language Detection and lsmcp Integration", () => {
  let client: Client | undefined;
  let transport: StdioClientTransport | undefined;
  let tmpDir: string | undefined;

  beforeEach(async () => {
    // Skip test if lsmcp.js is not built
    try {
      await fs.access(LSMCP_PATH);
    } catch {
      console.log("Skipping test: dist/lsmcp.js not found. Run 'pnpm build' first.");
      return;
    }

    // Check if pylsp is available
    try {
      execSync("pylsp --version", { stdio: "pipe" });
    } catch {
      console.log("Skipping test: pylsp not found. Install with: pip install python-lsp-server");
      return;
    }

    // Create temporary directory
    const hash = randomBytes(8).toString("hex");
    tmpDir = path.join(__dirname, `tmp-python-lsmcp-${hash}`);
    await fs.mkdir(tmpDir, { recursive: true });
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

  it("should auto-detect Python project with pyproject.toml", async () => {
    if (!tmpDir) return;

    // Create pyproject.toml
    await fs.writeFile(path.join(tmpDir, "pyproject.toml"), `[project]
name = "test-project"
version = "0.1.0"

[build-system]
requires = ["setuptools>=45"]
build-backend = "setuptools.build_meta"
`);

    // Create a Python file
    await fs.writeFile(path.join(tmpDir, "main.py"), `#!/usr/bin/env python3
"""Main module."""

def main():
    print("Hello from Python!")

if __name__ == "__main__":
    main()
`);

    // Create transport with auto-detection
    transport = new StdioClientTransport({
      command: "node",
      args: [LSMCP_PATH],
      env: {
        ...process.env,
        PROJECT_ROOT: tmpDir,
      } as Record<string, string>,
    });

    client = new Client({
      name: "test-client",
      version: "1.0.0",
    });

    await client.connect(transport);

    // Should have python_ prefixed tools
    const response = await client.listTools();
    const toolNames = response.tools.map(t => t.name);
    
    expect(toolNames).toContain("python_get_hover");
    expect(toolNames).toContain("python_find_references");
    expect(toolNames).toContain("python_get_diagnostics");
  });

  it("should auto-detect Python project with requirements.txt", async () => {
    if (!tmpDir) return;

    // Create requirements.txt
    await fs.writeFile(path.join(tmpDir, "requirements.txt"), `
requests>=2.28.0
numpy>=1.24.0
pandas>=2.0.0
`);

    // Create a Python file
    await fs.writeFile(path.join(tmpDir, "app.py"), `#!/usr/bin/env python3
"""Application module."""

import requests

def fetch_data(url: str) -> dict:
    """Fetch JSON data from URL."""
    response = requests.get(url)
    return response.json()
`);

    // Create transport with auto-detection
    transport = new StdioClientTransport({
      command: "node",
      args: [LSMCP_PATH],
      env: {
        ...process.env,
        PROJECT_ROOT: tmpDir,
      } as Record<string, string>,
    });

    client = new Client({
      name: "test-client",
      version: "1.0.0",
    });

    await client.connect(transport);

    // Test hover on requests module
    const result = await client.callTool({
      name: "python_get_hover",
      arguments: {
        root: tmpDir,
        filePath: "app.py",
        line: 4,
        target: "requests",
      },
    });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0]?.type).toBe("text");
    if (result.content[0]?.type === "text") {
      const text = result.content[0].text;
      expect(text.toLowerCase()).toContain("requests");
    }
  });

  it("should work with explicit -l python flag", async () => {
    if (!tmpDir) return;

    // Create a Python file without project markers
    await fs.writeFile(path.join(tmpDir, "script.py"), `#!/usr/bin/env python3
"""Simple script."""

def greet(name: str) -> str:
    """Return greeting message."""
    return f"Hello, {name}!"

if __name__ == "__main__":
    message = greet("Python")
    print(message)
`);

    // Create transport with explicit language
    transport = new StdioClientTransport({
      command: "node",
      args: [LSMCP_PATH, "-l", "python"],
      env: {
        ...process.env,
        PROJECT_ROOT: tmpDir,
      } as Record<string, string>,
    });

    client = new Client({
      name: "test-client",
      version: "1.0.0",
    });

    await client.connect(transport);

    // Should work with Python tools
    const result = await client.callTool({
      name: "python_get_hover",
      arguments: {
        root: tmpDir,
        filePath: "script.py",
        line: 9,
        target: "greet",
      },
    });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0]?.type).toBe("text");
    if (result.content[0]?.type === "text") {
      const text = result.content[0].text;
      expect(text).toContain("greet");
      expect(text.toLowerCase()).toMatch(/function|def|str/);
    }
  });

  it("should get Python diagnostics with custom command", async () => {
    if (!tmpDir) return;

    // Create a Python file with errors
    await fs.writeFile(path.join(tmpDir, "errors.py"), `#!/usr/bin/env python3
"""File with errors."""

def add(a: int, b: int) -> int:
    return a + b

# Type error
result = add("hello", "world")

# Name error
print(undefined_variable)

# Syntax error (missing colon)
def bad_function()
    pass
`);

    // Create transport with custom pylsp command
    transport = new StdioClientTransport({
      command: "node",
      args: [LSMCP_PATH, "--bin", "pylsp"],
      env: {
        ...process.env,
        PROJECT_ROOT: tmpDir,
      } as Record<string, string>,
    });

    client = new Client({
      name: "test-client",
      version: "1.0.0",
    });

    await client.connect(transport);

    // Get diagnostics
    const result = await client.callTool({
      name: "lsp_get_diagnostics",
      arguments: {
        root: tmpDir,
        filePath: "errors.py",
      },
    });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0]?.type).toBe("text");
    if (result.content[0]?.type === "text") {
      const text = result.content[0].text;
      expect(text).toContain("error");
      expect(text.toLowerCase()).toMatch(/undefined|syntax|type/);
    }
  });

  it("should rename Python symbols across files", async () => {
    if (!tmpDir) return;

    // Create a Python package structure
    await fs.writeFile(path.join(tmpDir, "pyproject.toml"), `[project]
name = "mypackage"
version = "0.1.0"
`);

    // Create utility module
    await fs.writeFile(path.join(tmpDir, "utils.py"), `#!/usr/bin/env python3
"""Utility functions."""

def calculate_total(items: list[float]) -> float:
    """Calculate the total of all items."""
    return sum(items)

def format_currency(amount: float) -> str:
    """Format amount as currency."""
    return f"$\{amount:.2f}"
`);

    // Create main module
    await fs.writeFile(path.join(tmpDir, "main.py"), `#!/usr/bin/env python3
"""Main module."""

from utils import calculate_total, format_currency

def process_order(prices: list[float]) -> str:
    """Process an order and return formatted total."""
    total = calculate_total(prices)
    return format_currency(total)

if __name__ == "__main__":
    prices = [10.50, 25.00, 15.75]
    result = process_order(prices)
    print(f"Order total: {result}")
    
    # Direct usage
    direct_total = calculate_total([1, 2, 3])
    print(f"Direct total: {format_currency(direct_total)}")
`);

    // Create transport
    transport = new StdioClientTransport({
      command: "node",
      args: [LSMCP_PATH],
      env: {
        ...process.env,
        PROJECT_ROOT: tmpDir,
      } as Record<string, string>,
    });

    client = new Client({
      name: "test-client",
      version: "1.0.0",
    });

    await client.connect(transport);

    // Rename calculate_total to compute_sum
    const result = await client.callTool({
      name: "python_rename_symbol",
      arguments: {
        root: tmpDir,
        filePath: "utils.py",
        line: 4,
        target: "calculate_total",
        newName: "compute_sum",
      },
    });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0]?.type).toBe("text");
    if (result.content[0]?.type === "text") {
      const text = result.content[0].text;
      expect(text).toContain("Successfully renamed");
    }

    // Verify the changes
    const utilsContent = await fs.readFile(path.join(tmpDir, "utils.py"), "utf-8");
    const mainContent = await fs.readFile(path.join(tmpDir, "main.py"), "utf-8");
    
    expect(utilsContent).toContain("def compute_sum(");
    expect(utilsContent).not.toContain("calculate_total");
    expect(mainContent).toContain("from utils import compute_sum");
    expect(mainContent).toContain("total = compute_sum(prices)");
    expect(mainContent).toContain("direct_total = compute_sum([1, 2, 3])");
  });

  it("should get Python workspace symbols", async () => {
    if (!tmpDir) return;

    // Create multiple Python files
    await fs.writeFile(path.join(tmpDir, "pyproject.toml"), `[project]
name = "workspace-test"
version = "0.1.0"
`);

    await fs.writeFile(path.join(tmpDir, "models.py"), `#!/usr/bin/env python3
"""Data models."""

class User:
    """User model."""
    def __init__(self, name: str, email: str):
        self.name = name
        self.email = email

class Product:
    """Product model."""
    def __init__(self, title: str, price: float):
        self.title = title
        self.price = price
`);

    await fs.writeFile(path.join(tmpDir, "services.py"), `#!/usr/bin/env python3
"""Service layer."""

from models import User, Product

class UserService:
    """Handle user operations."""
    def create_user(self, name: str, email: str) -> User:
        return User(name, email)

class ProductService:
    """Handle product operations."""
    def create_product(self, title: str, price: float) -> Product:
        return Product(title, price)
`);

    // Create transport
    transport = new StdioClientTransport({
      command: "node",
      args: [LSMCP_PATH],
      env: {
        ...process.env,
        PROJECT_ROOT: tmpDir,
      } as Record<string, string>,
    });

    client = new Client({
      name: "test-client",
      version: "1.0.0",
    });

    await client.connect(transport);

    // Search for workspace symbols
    const result = await client.callTool({
      name: "python_get_workspace_symbols",
      arguments: {
        query: "Service",
      },
    });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0]?.type).toBe("text");
    if (result.content[0]?.type === "text") {
      const text = result.content[0].text;
      expect(text).toContain("UserService");
      expect(text).toContain("ProductService");
      expect(text).toContain("services.py");
    }
  });
});