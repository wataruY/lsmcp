import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs/promises";
import { randomBytes } from "crypto";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MULTI_LANGUAGE_MCP_PATH = path.join(__dirname, "../dist/multi-language-mcp.js");

describe("Python MCP Server (via multi-language-mcp)", () => {
  let client: Client | undefined;
  let transport: StdioClientTransport | undefined;
  let tmpDir: string | undefined;

  beforeEach(async () => {
    // Skip test if multi-language-mcp.js is not built
    try {
      await fs.access(MULTI_LANGUAGE_MCP_PATH);
    } catch {
      console.log("Skipping test: dist/multi-language-mcp.js not found. Run 'pnpm build' first.");
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
    tmpDir = path.join(__dirname, `tmp-python-${hash}`);
    await fs.mkdir(tmpDir, { recursive: true });

    // Create a Python project
    await fs.writeFile(path.join(tmpDir, "pyproject.toml"), `[project]
name = "test-project"
version = "0.1.0"
description = "Test Python project"

[build-system]
requires = ["setuptools>=45"]
build-backend = "setuptools.build_meta"
`);

    // Create transport with server parameters
    transport = new StdioClientTransport({
      command: "node",
      args: [MULTI_LANGUAGE_MCP_PATH],
      env: {
        ...process.env,
        PROJECT_ROOT: tmpDir,
        FORCE_LANGUAGE: "python", // Force Python language
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

  it("should list available tools with python_ prefix", async () => {
    if (!client) return;

    const response = await client.listTools();
    const toolNames = response.tools.map(t => t.name);

    // Check for python-prefixed tools
    expect(toolNames).toContain("python_get_hover");
    expect(toolNames).toContain("python_find_references");
    expect(toolNames).toContain("python_get_definitions");
    expect(toolNames).toContain("python_get_diagnostics");
    expect(toolNames).toContain("python_rename_symbol");
    expect(toolNames).toContain("python_get_document_symbols");
    expect(toolNames).toContain("python_get_workspace_symbols");

    // Check that tools have python prefix
    const pythonTools = toolNames.filter(name => name.startsWith("python_"));
    expect(pythonTools.length).toBeGreaterThan(10);
  });

  it("should get hover information for Python code", async () => {
    if (!client) return;

    // Create a Python file
    const pythonCode = `#!/usr/bin/env python3
"""Test module for Python MCP."""

def greet(name: str) -> str:
    """Return a greeting message."""
    message = f"Hello, {name}!"
    return message

def main():
    result = greet("Python")
    print(result)

if __name__ == "__main__":
    main()
`;
    await fs.writeFile(path.join(tmpDir!, "hello.py"), pythonCode);

    // Get hover information for 'greet' function
    const result = await client.callTool({
      name: "python_get_hover",
      arguments: {
        root: tmpDir,
        filePath: "hello.py",
        line: 10,
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

  it("should get diagnostics for Python code with errors", async () => {
    if (!client) return;

    // Create a Python file with errors
    const pythonCode = `#!/usr/bin/env python3

def add(a: int, b: int) -> int:
    return a + b

# Error: wrong argument types
result = add("hello", "world")

# Error: undefined variable
print(undefined_variable)

# Error: indentation
    def bad_indent():
        pass
`;
    await fs.writeFile(path.join(tmpDir!, "errors.py"), pythonCode);

    // Get diagnostics
    const result = await client.callTool({
      name: "python_get_diagnostics",
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
      expect(text.toLowerCase()).toMatch(/undefined|indent|type/);
    }
  });

  it("should get document symbols for Python code", async () => {
    if (!client) return;

    // Create a Python file with various symbols
    const pythonCode = `#!/usr/bin/env python3
"""Module with various Python symbols."""

from typing import List, Optional

class Person:
    """A person class."""
    
    def __init__(self, name: str, age: int):
        self.name = name
        self.age = age
    
    def greet(self) -> str:
        """Return a greeting."""
        return f"Hello, I'm {self.name}"
    
    @property
    def is_adult(self) -> bool:
        """Check if person is adult."""
        return self.age >= 18

def create_people(names: List[str]) -> List[Person]:
    """Create a list of people."""
    return [Person(name, 25) for name in names]

# Global variable
DEFAULT_NAMES = ["Alice", "Bob", "Charlie"]

if __name__ == "__main__":
    people = create_people(DEFAULT_NAMES)
    for person in people:
        print(person.greet())
`;
    await fs.writeFile(path.join(tmpDir!, "symbols.py"), pythonCode);

    // Get document symbols
    const result = await client.callTool({
      name: "python_get_document_symbols",
      arguments: {
        root: tmpDir,
        filePath: "symbols.py",
      },
    });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0]?.type).toBe("text");
    if (result.content[0]?.type === "text") {
      const text = result.content[0].text;
      expect(text).toContain("Person");
      expect(text).toContain("__init__");
      expect(text).toContain("greet");
      expect(text).toContain("is_adult");
      expect(text).toContain("create_people");
      expect(text).toContain("DEFAULT_NAMES");
    }
  });

  it("should find references in Python code", async () => {
    if (!client) return;

    // Create multiple Python files
    const utilsCode = `#!/usr/bin/env python3
"""Utility functions."""

def calculate(x: int, y: int) -> int:
    """Add two numbers."""
    return x + y

def multiply(x: int, y: int) -> int:
    """Multiply two numbers."""
    return x * y
`;
    await fs.writeFile(path.join(tmpDir!, "utils.py"), utilsCode);

    const mainCode = `#!/usr/bin/env python3
"""Main module."""

from utils import calculate, multiply

def main():
    # Use calculate function
    result1 = calculate(5, 3)
    print(f"5 + 3 = {result1}")
    
    # Use it again
    result2 = calculate(10, 20)
    print(f"10 + 20 = {result2}")
    
    # Use multiply
    result3 = multiply(4, 5)
    print(f"4 * 5 = {result3}")

if __name__ == "__main__":
    main()
`;
    await fs.writeFile(path.join(tmpDir!, "main.py"), mainCode);

    // Find references to 'calculate'
    const result = await client.callTool({
      name: "python_find_references",
      arguments: {
        root: tmpDir,
        filePath: "utils.py",
        line: 4,
        symbolName: "calculate",
      },
    });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0]?.type).toBe("text");
    if (result.content[0]?.type === "text") {
      const text = result.content[0].text;
      expect(text).toContain("Found");
      expect(text).toContain("reference");
    }
  });

  it("should rename symbol in Python code", async () => {
    if (!client) return;

    // Create a Python file
    const pythonCode = `#!/usr/bin/env python3
"""Test renaming."""

def process_data(data: str) -> str:
    """Process the data."""
    return data.upper()

def main():
    result = process_data("hello")
    print(result)
    
    # Another call
    another = process_data("world")
    print(another)

if __name__ == "__main__":
    main()
`;
    await fs.writeFile(path.join(tmpDir!, "rename_test.py"), pythonCode);

    // Rename 'process_data' to 'transform_data'
    const result = await client.callTool({
      name: "python_rename_symbol",
      arguments: {
        root: tmpDir,
        filePath: "rename_test.py",
        line: 4,
        target: "process_data",
        newName: "transform_data",
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
    const content = await fs.readFile(path.join(tmpDir!, "rename_test.py"), "utf-8");
    expect(content).toContain("def transform_data(");
    expect(content).toContain("result = transform_data(");
    expect(content).toContain("another = transform_data(");
    expect(content).not.toContain("process_data");
  });

  it("should get completion suggestions for Python code", async () => {
    if (!client) return;

    // Create a Python file
    const pythonCode = `#!/usr/bin/env python3
"""Test completions."""

import os

def main():
    # Get completions for os module
    current_dir = os.ge
`;
    await fs.writeFile(path.join(tmpDir!, "completion.py"), pythonCode);

    // Get completions after 'os.ge'
    const result = await client.callTool({
      name: "python_get_completion",
      arguments: {
        root: tmpDir,
        filePath: "completion.py",
        line: 7,
        target: "ge",
      },
    });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0]?.type).toBe("text");
    if (result.content[0]?.type === "text") {
      const text = result.content[0].text;
      // Should suggest getcwd, getenv, etc.
      expect(text.toLowerCase()).toMatch(/getcwd|getenv|getpid/);
    }
  });

  it("should get signature help for Python functions", async () => {
    if (!client) return;

    // Create a Python file
    const pythonCode = `#!/usr/bin/env python3
"""Test signature help."""

def greet(name: str, age: int = 0, city: str = "Unknown") -> str:
    """Greet a person with their details."""
    return f"Hello {name}, age {age} from {city}"

# Get signature help here
result = greet("Alice", )
`;
    await fs.writeFile(path.join(tmpDir!, "signature.py"), pythonCode);

    // Get signature help inside greet call
    const result = await client.callTool({
      name: "python_get_signature_help",
      arguments: {
        root: tmpDir,
        filePath: "signature.py",
        line: 9,
        target: ",",
      },
    });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0]?.type).toBe("text");
    if (result.content[0]?.type === "text") {
      const text = result.content[0].text;
      expect(text).toContain("greet");
      expect(text).toContain("name: str");
      expect(text).toContain("age: int");
      expect(text).toContain("city: str");
    }
  });

  it("should list tools with Python descriptions", async () => {
    if (!client) return;

    const response = await client.callTool({
      name: "python_list_tools",
      arguments: {
        category: "lsp",
      },
    });

    expect(response).toBeDefined();
    expect(response.content).toBeDefined();
    expect(response.content[0]?.type).toBe("text");
    if (response.content[0]?.type === "text") {
      const text = response.content[0].text;
      // Should not mention TypeScript in Python tools
      expect(text).not.toContain("TypeScript");
      // Should have Python-specific descriptions
      expect(text).toContain("python_");
    }
  });
});