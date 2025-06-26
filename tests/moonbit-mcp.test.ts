import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { randomBytes } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOONBIT_MCP_PATH = path.join(__dirname, "../dist/moonbit-mcp.js");

describe("Moonbit MCP Server", () => {
  let client: Client;
  let transport: StdioClientTransport;
  let tmpDir: string;

  beforeEach(async () => {
    // Skip test if moonbit-mcp.js is not built
    try {
      await fs.access(MOONBIT_MCP_PATH);
    } catch {
      console.log("Skipping test: dist/moonbit-mcp.js not found. Run 'pnpm build' first.");
      return;
    }

    // Check if Moonbit LSP is available
    const home = process.env.HOME || process.env.USERPROFILE || "";
    const lspPath = path.join(home, ".moon/bin/lsp-server.js");
    if (!existsSync(lspPath)) {
      console.log("Skipping test: Moonbit LSP not found. Install Moonbit from https://www.moonbitlang.com/");
      return;
    }

    // Create temporary directory
    const hash = randomBytes(8).toString("hex");
    tmpDir = path.join(__dirname, `tmp-moonbit-${hash}`);
    await fs.mkdir(tmpDir, { recursive: true });

    // Create a minimal moon.mod.json to make it a Moonbit project
    await fs.writeFile(path.join(tmpDir, "moon.mod.json"), JSON.stringify({
      name: "test-project",
      version: "0.1.0",
    }, null, 2));

    // Create transport with server parameters
    transport = new StdioClientTransport({
      command: "node",
      args: [MOONBIT_MCP_PATH],
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

  it("should list available tools with moonbit_ prefix", async () => {
    if (!client) return;

    const response = await client.listTools();
    const toolNames = response.tools.map(t => t.name);

    // Check for moonbit-prefixed tools
    expect(toolNames).toContain("moonbit_get_hover");
    expect(toolNames).toContain("moonbit_find_references");
    expect(toolNames).toContain("moonbit_get_definitions");
    expect(toolNames).toContain("moonbit_get_diagnostics");
    expect(toolNames).toContain("moonbit_rename_symbol");
    expect(toolNames).toContain("moonbit_get_document_symbols");
    expect(toolNames).toContain("moonbit_get_workspace_symbols");

    // Check that tools have moonbit prefix
    const moonbitTools = toolNames.filter(name => name.startsWith("moonbit_"));
    expect(moonbitTools.length).toBeGreaterThan(10);
  });

  it("should get hover information for Moonbit code", async () => {
    if (!client) return;

    // Create a Moonbit file
    const moonbitCode = `
fn main {
  let message = "Hello, Moonbit!"
  println(message)
}
`;
    await fs.writeFile(path.join(tmpDir, "main.mbt"), moonbitCode);

    // Get hover information for 'message'
    const result = await client.callTool({
      name: "moonbit_get_hover",
      arguments: {
        root: tmpDir,
        filePath: "main.mbt",
        line: 3,
        target: "message",
      },
    });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0]?.type).toBe("text");
    if (result.content[0]?.type === "text") {
      const text = result.content[0].text;
      expect(text).toContain("String");
    }
  });

  it("should get diagnostics for Moonbit code with errors", async () => {
    if (!client) return;

    // Create a Moonbit file with an error
    const moonbitCode = `
fn main {
  let x : Int = "not a number" // Type error
  println(x.to_string())
}
`;
    await fs.writeFile(path.join(tmpDir, "error.mbt"), moonbitCode);

    // Get diagnostics
    const result = await client.callTool({
      name: "moonbit_get_diagnostics",
      arguments: {
        root: tmpDir,
        filePath: "error.mbt",
      },
    });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0]?.type).toBe("text");
    if (result.content[0]?.type === "text") {
      const text = result.content[0].text;
      // Moonbit might report type errors differently
      expect(text.toLowerCase()).toMatch(/type|error|mismatch/);
    }
  });

  it("should get document symbols for Moonbit code", async () => {
    if (!client) return;

    // Create a Moonbit file with various symbols
    const moonbitCode = `
struct Person {
  name : String
  age : Int
}

fn new_person(name : String, age : Int) -> Person {
  { name, age }
}

fn greet(person : Person) -> Unit {
  println("Hello, I'm " + person.name)
}

fn main {
  let person = new_person("Alice", 30)
  greet(person)
}
`;
    await fs.writeFile(path.join(tmpDir, "person.mbt"), moonbitCode);

    // Get document symbols
    const result = await client.callTool({
      name: "moonbit_get_document_symbols",
      arguments: {
        root: tmpDir,
        filePath: "person.mbt",
      },
    });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0]?.type).toBe("text");
    if (result.content[0]?.type === "text") {
      const text = result.content[0].text;
      expect(text).toContain("Person");
      expect(text).toContain("new_person");
      expect(text).toContain("greet");
      expect(text).toContain("main");
    }
  });

  it("should find references in Moonbit code", async () => {
    if (!client) return;

    // Create a Moonbit file with multiple references
    const moonbitCode = `
fn calculate(x : Int, y : Int) -> Int {
  x + y
}

fn main {
  let result = calculate(5, 3)
  println("Result: " + result.to_string())
  
  let another = calculate(10, 20)
  println("Another: " + another.to_string())
}
`;
    await fs.writeFile(path.join(tmpDir, "calc.mbt"), moonbitCode);

    // Find references to 'calculate'
    const result = await client.callTool({
      name: "moonbit_find_references",
      arguments: {
        root: tmpDir,
        filePath: "calc.mbt",
        line: 2,
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

  it("should rename symbol in Moonbit code", async () => {
    if (!client) return;

    // Create a Moonbit file
    const moonbitCode = `
fn add(x : Int, y : Int) -> Int {
  x + y
}

fn main {
  let sum = add(1, 2)
  println(sum.to_string())
}
`;
    await fs.writeFile(path.join(tmpDir, "rename.mbt"), moonbitCode);

    // Rename 'add' to 'sum'
    const result = await client.callTool({
      name: "moonbit_rename_symbol",
      arguments: {
        root: tmpDir,
        filePath: "rename.mbt",
        line: 2,
        target: "add",
        newName: "sum_numbers",
      },
    });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0]?.type).toBe("text");
    if (result.content[0]?.type === "text") {
      const text = result.content[0].text;
      expect(text).toContain("Successfully renamed");
    }
  });

  it("should list tools with moonbit descriptions", async () => {
    if (!client) return;

    const response = await client.callTool({
      name: "moonbit_list_tools",
      arguments: {
        category: "lsp",
      },
    });

    expect(response).toBeDefined();
    expect(response.content).toBeDefined();
    expect(response.content[0]?.type).toBe("text");
    if (response.content[0]?.type === "text") {
      const text = response.content[0].text;
      // Should not mention TypeScript in Moonbit tools
      expect(text).not.toContain("TypeScript");
      // Should have Moonbit-specific descriptions
      expect(text).toContain("moonbit_");
    }
  });
});