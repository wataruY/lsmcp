import { spawn } from "child_process";
import { resolve } from "path";

async function testTsserver() {
  console.log("Testing tsserver directly...");
  
  try {
    // Use absolute path to tsserver
    const tsserverPath = resolve("../../node_modules/.pnpm/typescript@5.8.3/node_modules/typescript/lib/tsserver.js");
    console.log("Tsserver path:", tsserverPath);
    
    const tsserver = spawn("node", [tsserverPath, "--stdio"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    
    let output = "";
    
    tsserver.stdout?.on("data", (data) => {
      output += data.toString();
      console.log("stdout:", data.toString());
    });
    
    tsserver.stderr?.on("data", (data) => {
      console.log("stderr:", data.toString());
    });
    
    tsserver.on("error", (error) => {
      console.error("Process error:", error);
    });
    
    tsserver.on("exit", (code) => {
      console.log("Process exited with code:", code);
    });
    
    // Send a simple request
    const request = {
      seq: 0,
      type: "request",
      command: "configure",
      arguments: {
        hostInfo: "test",
      }
    };
    
    const message = JSON.stringify(request) + "\n";
    console.log("Sending:", message);
    tsserver.stdin?.write(message);
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log("Total output received:", output.length, "bytes");
    
    // Kill the process
    tsserver.kill();
    
  } catch (error) {
    console.error("Error:", error);
  }
}

testTsserver().catch(console.error);