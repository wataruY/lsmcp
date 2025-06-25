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

describe("Go MCP Server (via multi-language-mcp)", () => {
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

    // Check if gopls is available
    try {
      execSync("gopls version", { stdio: "pipe" });
    } catch {
      console.log("Skipping test: gopls not found. Install with: go install golang.org/x/tools/gopls@latest");
      return;
    }

    // Create temporary directory
    const hash = randomBytes(8).toString("hex");
    tmpDir = path.join(__dirname, `tmp-go-${hash}`);
    await fs.mkdir(tmpDir, { recursive: true });

    // Create a Go module
    await fs.writeFile(path.join(tmpDir, "go.mod"), `module example.com/test
go 1.21
`);

    // Create transport with server parameters
    transport = new StdioClientTransport({
      command: "node",
      args: [MULTI_LANGUAGE_MCP_PATH],
      env: {
        ...process.env,
        PROJECT_ROOT: tmpDir,
        FORCE_LANGUAGE: "go", // Force Go language
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

  it("should list available tools with go_ prefix", async () => {
    if (!client) return;

    const response = await client.listTools();
    const toolNames = response.tools.map(t => t.name);

    // Check for go-prefixed tools
    expect(toolNames).toContain("go_get_hover");
    expect(toolNames).toContain("go_find_references");
    expect(toolNames).toContain("go_get_definitions");
    expect(toolNames).toContain("go_get_diagnostics");
    expect(toolNames).toContain("go_rename_symbol");
    expect(toolNames).toContain("go_get_document_symbols");
    expect(toolNames).toContain("go_get_workspace_symbols");

    // Check that tools have go prefix
    const goTools = toolNames.filter(name => name.startsWith("go_"));
    expect(goTools.length).toBeGreaterThan(10);
  });

  it("should get hover information for Go code", async () => {
    if (!client) return;

    // Create a Go file
    const goCode = `package main

import "fmt"

func main() {
    message := "Hello, Go!"
    fmt.Println(message)
}
`;
    await fs.writeFile(path.join(tmpDir!, "main.go"), goCode);

    // Get hover information for 'message'
    const result = await client.callTool({
      name: "go_get_hover",
      arguments: {
        root: tmpDir,
        filePath: "main.go",
        line: 6,
        target: "message",
      },
    });

    expect(result.isError).toBe(false);
    if (!result.isError && result.content[0]?.type === "text") {
      const text = result.content[0].text;
      expect(text).toContain("string");
    }
  });

  it("should get diagnostics for Go code with errors", async () => {
    if (!client) return;

    // Create a Go file with an error
    const goCode = `package main

import "fmt"

func main() {
    x := 42
    y := "not a number"
    result := x + y // Type error: cannot add int and string
    fmt.Println(result)
}
`;
    await fs.writeFile(path.join(tmpDir!, "error.go"), goCode);

    // Get diagnostics
    const result = await client.callTool({
      name: "go_get_diagnostics",
      arguments: {
        root: tmpDir,
        filePath: "error.go",
      },
    });

    expect(result.isError).toBe(false);
    if (!result.isError && result.content[0]?.type === "text") {
      const text = result.content[0].text;
      expect(text).toContain("error");
      expect(text.toLowerCase()).toMatch(/type|mismatch|cannot|invalid/);
    }
  });

  it("should get document symbols for Go code", async () => {
    if (!client) return;

    // Create a Go file with various symbols
    const goCode = `package main

import "fmt"

type Person struct {
    Name string
    Age  int
}

func NewPerson(name string, age int) *Person {
    return &Person{Name: name, Age: age}
}

func (p *Person) Greet() {
    fmt.Printf("Hello, I'm %s and I'm %d years old\\n", p.Name, p.Age)
}

func main() {
    person := NewPerson("Alice", 30)
    person.Greet()
}
`;
    await fs.writeFile(path.join(tmpDir!, "person.go"), goCode);

    // Get document symbols
    const result = await client.callTool({
      name: "go_get_document_symbols",
      arguments: {
        root: tmpDir,
        filePath: "person.go",
      },
    });

    expect(result.isError).toBe(false);
    if (!result.isError && result.content[0]?.type === "text") {
      const text = result.content[0].text;
      expect(text).toContain("Person");
      expect(text).toContain("NewPerson");
      expect(text).toContain("Greet");
      expect(text).toContain("main");
    }
  });

  it("should find references in Go code", async () => {
    if (!client) return;

    // Create multiple Go files
    const utilsCode = `package main

func Add(a, b int) int {
    return a + b
}
`;
    await fs.writeFile(path.join(tmpDir!, "utils.go"), utilsCode);

    const mainCode = `package main

import "fmt"

func main() {
    result := Add(5, 3)
    fmt.Println("Result:", result)
    
    another := Add(10, 20)
    fmt.Println("Another:", another)
}
`;
    await fs.writeFile(path.join(tmpDir!, "main.go"), mainCode);

    // Find references to 'Add'
    const result = await client.callTool({
      name: "go_find_references",
      arguments: {
        root: tmpDir,
        filePath: "utils.go",
        line: 3,
        symbolName: "Add",
      },
    });

    expect(result.isError).toBe(false);
    if (!result.isError && result.content[0]?.type === "text") {
      const text = result.content[0].text;
      expect(text).toContain("Found");
      expect(text).toContain("reference");
    }
  });

  it("should rename symbol in Go code", async () => {
    if (!client) return;

    // Create a Go file
    const goCode = `package main

func calculate(x, y int) int {
    return x + y
}

func main() {
    result := calculate(5, 3)
    println(result)
}
`;
    await fs.writeFile(path.join(tmpDir!, "calc.go"), goCode);

    // Rename 'calculate' to 'add'
    const result = await client.callTool({
      name: "go_rename_symbol",
      arguments: {
        root: tmpDir,
        filePath: "calc.go",
        line: 3,
        target: "calculate",
        newName: "add",
      },
    });

    expect(result.isError).toBe(false);
    if (!result.isError && result.content[0]?.type === "text") {
      const text = result.content[0].text;
      expect(text).toContain("Successfully renamed");
    }

    // Verify the changes
    const content = await fs.readFile(path.join(tmpDir!, "calc.go"), "utf-8");
    expect(content).toContain("func add(");
    expect(content).toContain("result := add(");
    expect(content).not.toContain("calculate");
  });

  it("should get completion suggestions for Go code", async () => {
    if (!client) return;

    // Create a Go file
    const goCode = `package main

import "fmt"

func main() {
    message := "Hello, World!"
    fmt.Pr
}
`;
    await fs.writeFile(path.join(tmpDir!, "completion.go"), goCode);

    // Get completions after 'fmt.Pr'
    const result = await client.callTool({
      name: "go_get_completion",
      arguments: {
        root: tmpDir,
        filePath: "completion.go",
        line: 7,
        target: "Pr",
      },
    });

    expect(result.isError).toBe(false);
    if (!result.isError && result.content[0]?.type === "text") {
      const text = result.content[0].text;
      // Should suggest Printf, Println, Print
      expect(text).toContain("Print");
      expect(text.toLowerCase()).toMatch(/printf|println/);
    }
  });

  it("should list tools with Go descriptions", async () => {
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
      // Should not mention TypeScript in Go tools
      expect(text).not.toContain("TypeScript");
      // Should have Go-specific descriptions
      expect(text).toContain("go_");
    }
  });
});