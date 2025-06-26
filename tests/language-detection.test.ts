import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs/promises";
import { randomBytes } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LSMCP_PATH = path.join(__dirname, "../dist/lsmcp.js");

describe("Language Detection with lsmcp", () => {
  let tmpDir: string;

  beforeEach(async () => {
    // Create temporary directory
    const hash = randomBytes(8).toString("hex");
    tmpDir = path.join(__dirname, `tmp-lang-detect-${hash}`);
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  async function runLsmcp(cwd: string, args: string[] = []): Promise<{ stdout: string; stderr: string; code: number | null }> {
    return new Promise((resolve) => {
      const proc = spawn("node", [LSMCP_PATH, ...args], {
        cwd,
        env: {
          ...process.env,
          PROJECT_ROOT: cwd,
          DEBUG: "true", // Enable debug output
        } as Record<string, string>,
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        resolve({ stdout, stderr, code });
      });

      proc.on("error", (err) => {
        resolve({ stdout, stderr: err.message, code: -1 });
      });
    });
  }

  it("should detect TypeScript project", async () => {
    // Skip test if lsmcp.js is not built
    try {
      await fs.access(LSMCP_PATH);
    } catch {
      console.log("Skipping test: dist/lsmcp.js not found. Run 'pnpm build' first.");
      return;
    }

    // Create tsconfig.json
    await fs.writeFile(path.join(tmpDir, "tsconfig.json"), JSON.stringify({
      compilerOptions: {
        target: "es2020",
        module: "commonjs",
      }
    }, null, 2));

    // Create a TypeScript file
    await fs.writeFile(path.join(tmpDir, "index.ts"), `
export function hello() {
  console.log("Hello from TypeScript!");
}
`);

    const result = await runLsmcp(tmpDir, ["--help"]);
    expect(result.code).toBe(0);
    expect(result.stderr).toContain("Auto-detected language: typescript");
  });

  it("should detect Rust project", async () => {
    // Skip test if lsmcp.js is not built
    try {
      await fs.access(LSMCP_PATH);
    } catch {
      console.log("Skipping test: dist/lsmcp.js not found. Run 'pnpm build' first.");
      return;
    }

    // Create Cargo.toml
    await fs.writeFile(path.join(tmpDir, "Cargo.toml"), `[package]
name = "test-project"
version = "0.1.0"
edition = "2021"
`);

    // Create a Rust file
    await fs.mkdir(path.join(tmpDir, "src"));
    await fs.writeFile(path.join(tmpDir, "src/main.rs"), `
fn main() {
    println!("Hello from Rust!");
}
`);

    const result = await runLsmcp(tmpDir, ["--help"]);
    expect(result.code).toBe(0);
    expect(result.stderr).toContain("Auto-detected language: rust");
  });

  it("should detect Moonbit project", async () => {
    // Skip test if lsmcp.js is not built
    try {
      await fs.access(LSMCP_PATH);
    } catch {
      console.log("Skipping test: dist/lsmcp.js not found. Run 'pnpm build' first.");
      return;
    }

    // Create moon.mod.json
    await fs.writeFile(path.join(tmpDir, "moon.mod.json"), JSON.stringify({
      name: "test-project",
      version: "0.1.0",
    }, null, 2));

    // Create a Moonbit file
    await fs.writeFile(path.join(tmpDir, "main.mbt"), `
fn main {
  println("Hello from Moonbit!")
}
`);

    const result = await runLsmcp(tmpDir, ["--help"]);
    expect(result.code).toBe(0);
    expect(result.stderr).toContain("Auto-detected language: moonbit");
  });

  it("should detect Python project", async () => {
    // Skip test if lsmcp.js is not built
    try {
      await fs.access(LSMCP_PATH);
    } catch {
      console.log("Skipping test: dist/lsmcp.js not found. Run 'pnpm build' first.");
      return;
    }

    // Create pyproject.toml
    await fs.writeFile(path.join(tmpDir, "pyproject.toml"), `[project]
name = "test-project"
version = "0.1.0"
`);

    // Create a Python file
    await fs.writeFile(path.join(tmpDir, "main.py"), `
def main():
    print("Hello from Python!")

if __name__ == "__main__":
    main()
`);

    const result = await runLsmcp(tmpDir, ["--help"]);
    expect(result.code).toBe(0);
    expect(result.stderr).toContain("Auto-detected language: python");
  });

  it("should detect JavaScript project", async () => {
    // Skip test if lsmcp.js is not built
    try {
      await fs.access(LSMCP_PATH);
    } catch {
      console.log("Skipping test: dist/lsmcp.js not found. Run 'pnpm build' first.");
      return;
    }

    // Create package.json without TypeScript
    await fs.writeFile(path.join(tmpDir, "package.json"), JSON.stringify({
      name: "test-project",
      version: "1.0.0",
      main: "index.js",
    }, null, 2));

    // Create a JavaScript file
    await fs.writeFile(path.join(tmpDir, "index.js"), `
function hello() {
  console.log("Hello from JavaScript!");
}

module.exports = { hello };
`);

    const result = await runLsmcp(tmpDir, ["--help"]);
    expect(result.code).toBe(0);
    expect(result.stderr).toContain("Auto-detected language: javascript");
  });

  it("should detect Go project", async () => {
    // Skip test if lsmcp.js is not built
    try {
      await fs.access(LSMCP_PATH);
    } catch {
      console.log("Skipping test: dist/lsmcp.js not found. Run 'pnpm build' first.");
      return;
    }

    // Create go.mod
    await fs.writeFile(path.join(tmpDir, "go.mod"), `module test-project

go 1.21
`);

    // Create a Go file
    await fs.writeFile(path.join(tmpDir, "main.go"), `
package main

import "fmt"

func main() {
    fmt.Println("Hello from Go!")
}
`);

    const result = await runLsmcp(tmpDir, ["--help"]);
    expect(result.code).toBe(0);
    expect(result.stderr).toContain("Auto-detected language: go");
  });

  it("should fail when no project detected", async () => {
    // Skip test if lsmcp.js is not built
    try {
      await fs.access(LSMCP_PATH);
    } catch {
      console.log("Skipping test: dist/lsmcp.js not found. Run 'pnpm build' first.");
      return;
    }

    // Don't create any project files
    await fs.writeFile(path.join(tmpDir, "random.txt"), "Some random file");

    // When running without --help (to actually start the server), it should fail
    const result = await runLsmcp(tmpDir, []);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Could not detect project language");
  });

  it("should override detection with --language flag", async () => {
    // Skip test if lsmcp.js is not built
    try {
      await fs.access(LSMCP_PATH);
    } catch {
      console.log("Skipping test: dist/lsmcp.js not found. Run 'pnpm build' first.");
      return;
    }

    // Create a TypeScript project
    await fs.writeFile(path.join(tmpDir, "tsconfig.json"), JSON.stringify({
      compilerOptions: {
        target: "es2020",
      }
    }, null, 2));

    // But override to use Rust
    const result = await runLsmcp(tmpDir, ["--language", "rust", "--help"]);

    // Should not see auto-detection message when language is specified
    expect(result.stderr).not.toContain("Auto-detected language");
  });
});