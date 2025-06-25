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

describe("Go Language Server via lsmcp", () => {
  let tmpDir: string | undefined;

  beforeEach(async () => {
    // Skip test if lsmcp.js is not built
    try {
      await fs.access(LSMCP_PATH);
    } catch {
      console.log("Skipping test: dist/lsmcp.js not found. Run 'pnpm build' first.");
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
    tmpDir = path.join(__dirname, `tmp-lsmcp-go-${hash}`);
    await fs.mkdir(tmpDir, { recursive: true });

    // Create a Go module
    await fs.writeFile(path.join(tmpDir, "go.mod"), `module example.com/test
go 1.21
`);
  });

  afterEach(async () => {
    // Cleanup
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  async function createMCPClient(additionalArgs: string[] = []): Promise<Client> {
    const transport = new StdioClientTransport({
      command: "node",
      args: [LSMCP_PATH, ...additionalArgs],
      env: {
        ...process.env,
        PROJECT_ROOT: tmpDir,
      } as Record<string, string>,
    });

    const client = new Client({
      name: "test-client",
      version: "1.0.0",
    });

    await client.connect(transport);
    return client;
  }

  it("should auto-detect Go project", async () => {
    if (!tmpDir) return;

    // Create a simple Go file
    const goCode = `package main

func main() {
    println("Hello from Go!")
}
`;
    await fs.writeFile(path.join(tmpDir, "main.go"), goCode);

    const client = await createMCPClient();

    try {
      // List tools - should have go_ prefix
      const response = await client.listTools();
      const toolNames = response.tools.map(t => t.name);
      
      expect(toolNames).toContain("go_get_hover");
      expect(toolNames).toContain("go_find_references");
      expect(toolNames).toContain("go_get_diagnostics");
    } finally {
      await client.close();
    }
  });

  it("should work with explicit --language go flag", async () => {
    if (!tmpDir) return;

    const client = await createMCPClient(["--language", "go"]);

    try {
      // Create a Go file
      const goCode = `package main

import "strings"

func main() {
    text := "Hello, World!"
    upper := strings.ToUpper(text)
    println(upper)
}
`;
      await fs.writeFile(path.join(tmpDir, "string_ops.go"), goCode);

      // Get hover information
      const result = await client.callTool({
        name: "go_get_hover",
        arguments: {
          root: tmpDir,
          filePath: "string_ops.go",
          line: 7,
          target: "ToUpper",
        },
      });

      expect(result.isError).toBe(false);
      if (!result.isError && result.content[0]?.type === "text") {
        const text = result.content[0].text;
        expect(text).toContain("func");
        expect(text).toContain("string");
      }
    } finally {
      await client.close();
    }
  });

  it("should use custom gopls via --bin option", async () => {
    if (!tmpDir) return;

    const client = await createMCPClient(["--bin", "gopls -rpc.trace"]);

    try {
      // Create a Go file with interface
      const goCode = `package main

type Writer interface {
    Write([]byte) (int, error)
}

type ConsoleWriter struct{}

func (c ConsoleWriter) Write(data []byte) (int, error) {
    println(string(data))
    return len(data), nil
}

func main() {
    var w Writer = ConsoleWriter{}
    w.Write([]byte("Hello"))
}
`;
      await fs.writeFile(path.join(tmpDir, "interface.go"), goCode);

      // Get document symbols
      const result = await client.callTool({
        name: "lsp_get_document_symbols",
        arguments: {
          root: tmpDir,
          filePath: "interface.go",
        },
      });

      expect(result.isError).toBe(false);
      if (!result.isError && result.content[0]?.type === "text") {
        const text = result.content[0].text;
        expect(text).toContain("Writer");
        expect(text).toContain("ConsoleWriter");
        expect(text).toContain("Write");
      }
    } finally {
      await client.close();
    }
  });

  it("should handle Go modules with dependencies", async () => {
    if (!tmpDir) return;

    // Create a Go file that uses external package
    const goCode = `package main

import (
    "fmt"
    "time"
)

func main() {
    now := time.Now()
    fmt.Printf("Current time: %v\\n", now)
}
`;
    await fs.writeFile(path.join(tmpDir, "time_example.go"), goCode);

    const client = await createMCPClient(["-l", "go"]);

    try {
      // Find references to time.Now
      const result = await client.callTool({
        name: "go_find_references",
        arguments: {
          root: tmpDir,
          filePath: "time_example.go",
          line: 9,
          symbolName: "Now",
        },
      });

      expect(result.isError).toBe(false);
      if (!result.isError && result.content[0]?.type === "text") {
        const text = result.content[0].text;
        expect(text).toContain("Found");
      }
    } finally {
      await client.close();
    }
  });

  it("should get Go-specific diagnostics", async () => {
    if (!tmpDir) return;

    // Create a Go file with various issues
    const goCode = `package main

import "fmt"

func main() {
    // Unused variable
    x := 42
    
    // Wrong format verb
    fmt.Printf("%s", 123)
    
    // Unreachable code
    return
    fmt.Println("This won't run")
}
`;
    await fs.writeFile(path.join(tmpDir, "issues.go"), goCode);

    const client = await createMCPClient(["-l", "go"]);

    try {
      const result = await client.callTool({
        name: "go_get_diagnostics",
        arguments: {
          root: tmpDir,
          filePath: "issues.go",
        },
      });

      expect(result.isError).toBe(false);
      if (!result.isError && result.content[0]?.type === "text") {
        const text = result.content[0].text;
        // Should detect various Go-specific issues
        expect(text.toLowerCase()).toMatch(/unused|format|unreachable|declared|not used/);
      }
    } finally {
      await client.close();
    }
  });
});