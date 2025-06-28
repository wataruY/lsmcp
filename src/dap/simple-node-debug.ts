#!/usr/bin/env node
// @ts-nocheck
/**
 * シンプルなNode.jsデバッグ実装
 * Node.jsの--inspectフラグを使用して、基本的なデバッグ機能を提供
 */

import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import * as WebSocket from "ws";
import * as http from "http";

interface DebuggerInfo {
  description: string;
  devtoolsFrontendUrl: string;
  id: string;
  title: string;
  type: string;
  url: string;
  webSocketDebuggerUrl: string;
}

export class SimpleNodeDebugger extends EventEmitter {
  private process: ChildProcess | null = null;
  private ws: WebSocket | null = null;
  private port: number = 0;
  private messageId = 1;
  private pendingCallbacks = new Map<number, (result: any) => void>();

  async launch(program: string, args: string[] = []): Promise<void> {
    // ランダムなポートで--inspectを開始
    this.port = 9229 + Math.floor(Math.random() * 1000);
    
    this.process = spawn("node", [`--inspect-brk=${this.port}`, program, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.process.stdout?.on("data", (data) => {
      this.emit("output", { type: "stdout", text: data.toString() });
    });

    this.process.stderr?.on("data", (data) => {
      const text = data.toString();
      // デバッガーメッセージをフィルタリング
      if (!text.includes("Debugger listening on") && !text.includes("For help, see")) {
        this.emit("output", { type: "stderr", text });
      }
    });

    this.process.on("exit", (code) => {
      this.emit("terminated", { code });
    });

    // デバッガーが起動するまで待機
    await this.waitForDebugger();
    await this.connect();
  }

  private async waitForDebugger(maxAttempts = 10): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const info = await this.getDebuggerInfo();
        if (info) return;
      } catch (e) {
        // まだ起動していない
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    throw new Error("Debugger failed to start");
  }

  private async getDebuggerInfo(): Promise<DebuggerInfo> {
    return new Promise((resolve, reject) => {
      http.get(`http://localhost:${this.port}/json`, (res) => {
        let data = "";
        res.on("data", chunk => data += chunk);
        res.on("end", () => {
          try {
            const targets = JSON.parse(data);
            if (targets.length > 0) {
              resolve(targets[0]);
            } else {
              reject(new Error("No debug targets"));
            }
          } catch (e) {
            reject(e);
          }
        });
      }).on("error", reject);
    });
  }

  private async connect(): Promise<void> {
    const info = await this.getDebuggerInfo();
    
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(info.webSocketDebuggerUrl);
      
      this.ws.on("open", () => {
        this.setupProtocol();
        resolve();
      });

      this.ws.on("message", (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.id && this.pendingCallbacks.has(message.id)) {
          const callback = this.pendingCallbacks.get(message.id)!;
          this.pendingCallbacks.delete(message.id);
          callback(message.result);
        } else if (message.method) {
          this.handleEvent(message);
        }
      });

      this.ws.on("error", reject);
    });
  }

  private async setupProtocol(): Promise<void> {
    // Enable necessary domains
    await this.sendCommand("Runtime.enable");
    await this.sendCommand("Debugger.enable");
    await this.sendCommand("Runtime.runIfWaitingForDebugger");
  }

  private sendCommand(method: string, params: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = this.messageId++;
      
      this.pendingCallbacks.set(id, resolve);
      
      this.ws?.send(JSON.stringify({
        id,
        method,
        params
      }));

      // タイムアウト
      setTimeout(() => {
        if (this.pendingCallbacks.has(id)) {
          this.pendingCallbacks.delete(id);
          reject(new Error(`Command ${method} timed out`));
        }
      }, 5000);
    });
  }

  private handleEvent(message: any): void {
    switch (message.method) {
      case "Debugger.paused":
        this.emit("paused", {
          reason: message.params.reason,
          callFrames: message.params.callFrames,
        });
        break;
      
      case "Debugger.resumed":
        this.emit("resumed");
        break;
      
      case "Runtime.consoleAPICalled":
        const args = message.params.args.map((arg: any) => 
          arg.value !== undefined ? arg.value : arg.description
        ).join(" ");
        this.emit("output", { type: "console", text: args + "\n" });
        break;
    }
  }

  async setBreakpoint(filePath: string, line: number): Promise<string> {
    const result = await this.sendCommand("Debugger.setBreakpointByUrl", {
      lineNumber: line - 1, // 0-based
      url: `file://${filePath}`,
    });
    return result.breakpointId;
  }

  async removeBreakpoint(breakpointId: string): Promise<void> {
    await this.sendCommand("Debugger.removeBreakpoint", { breakpointId });
  }

  async continue(): Promise<void> {
    await this.sendCommand("Debugger.resume");
  }

  async stepOver(): Promise<void> {
    await this.sendCommand("Debugger.stepOver");
  }

  async stepInto(): Promise<void> {
    await this.sendCommand("Debugger.stepInto");
  }

  async stepOut(): Promise<void> {
    await this.sendCommand("Debugger.stepOut");
  }

  async evaluate(expression: string, callFrameId?: string): Promise<any> {
    if (callFrameId) {
      const result = await this.sendCommand("Debugger.evaluateOnCallFrame", {
        callFrameId,
        expression,
      });
      return result;
    } else {
      const result = await this.sendCommand("Runtime.evaluate", {
        expression,
      });
      return result;
    }
  }

  async getVariables(objectId: string): Promise<any[]> {
    const result = await this.sendCommand("Runtime.getProperties", {
      objectId,
      ownProperties: true,
    });
    return result.result;
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}

// テスト用のCLI
if (import.meta.url === `file://${process.argv[1]}`) {
  async function test() {
    const nodeDebugger = new SimpleNodeDebugger();
    
    console.log("Starting debugger...");
    
    nodeDebugger.on("output", (e) => {
      process.stdout.write(`[${e.type}] ${e.text}`);
    });
    
    nodeDebugger.on("paused", async (e) => {
      console.log(`\nPaused: ${e.reason}`);
      if (e.callFrames.length > 0) {
        const frame = e.callFrames[0];
        console.log(`  at ${frame.url}:${frame.location.lineNumber + 1}`);
        
        // ローカル変数を取得
        if (frame.scopeChain[0]) {
          const vars = await nodeDebugger.getVariables(frame.scopeChain[0].object.objectId);
          console.log("  Local variables:");
          for (const v of vars) {
            if (v.name !== "arguments" && !v.name.startsWith("__")) {
              console.log(`    ${v.name} = ${v.value?.value ?? v.value?.description}`);
            }
          }
        }
      }
      
      // 続行
      setTimeout(() => {
        console.log("\nContinuing...");
        nodeDebugger.continue();
      }, 1000);
    });
    
    await nodeDebugger.launch(process.argv[2] || "./test-simple.js");
    
    // ブレークポイントを設定
    const bp1 = await nodeDebugger.setBreakpoint(process.argv[2] || "./test-simple.js", 5);
    const bp2 = await nodeDebugger.setBreakpoint(process.argv[2] || "./test-simple.js", 8);
    console.log(`Breakpoints set: ${bp1}, ${bp2}`);
    
    // プログラムを続行
    await nodeDebugger.continue();
  }
  
  test().catch(console.error);
}