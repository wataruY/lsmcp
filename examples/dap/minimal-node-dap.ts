/**
 * Minimal Node.js DAP Adapter using --inspect-brk
 * 
 * This demonstrates the most lightweight approach to creating a DAP adapter
 * for Node.js by spawning node with --inspect-brk and bridging the protocols.
 */

import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import WebSocket from "ws";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";

interface InspectorInfo {
  description: string;
  devtoolsFrontendUrl: string;
  id: string;
  title: string;
  type: string;
  url: string;
  webSocketDebuggerUrl: string;
}

/**
 * Minimal DAP adapter for Node.js debugging
 */
export class MinimalNodeDAPAdapter extends EventEmitter {
  private process: ChildProcess | null = null;
  private ws: WebSocket | null = null;
  private messageId = 1;
  private scriptIdToPath = new Map<string, string>();
  private breakpointIdToDAP = new Map<string, number>();
  private dapBreakpointId = 1;
  private callFrames: any[] = [];
  private scopeIdCounter = 1;
  private variableRefCounter = 1000;
  private variableRefToObject = new Map<number, string>();

  /**
   * Launch Node.js process with debugging enabled
   */
  async launch(
    program: string,
    args: string[] = [],
    options: {
      cwd?: string;
      env?: Record<string, string>;
      stopOnEntry?: boolean;
      port?: number;
    } = {}
  ): Promise<void> {
    const debugPort = options.port || 9229;
    const nodeArgs = [
      options.stopOnEntry ? '--inspect-brk' : '--inspect',
      `--inspect-port=${debugPort}`,
      program,
      ...args
    ];

    this.process = spawn('node', nodeArgs, {
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Forward stdout/stderr as output events
    this.process.stdout?.on('data', (data) => {
      this.emit('output', {
        category: 'stdout',
        output: data.toString()
      });
    });

    this.process.stderr?.on('data', (data) => {
      const text = data.toString();
      // Filter out debugger listening messages
      if (!text.includes('Debugger listening on ws://')) {
        this.emit('output', {
          category: 'stderr',
          output: text
        });
      }
    });

    this.process.on('exit', (code, signal) => {
      this.emit('terminated', { exitCode: code });
      this.cleanup();
    });

    // Wait for debugger to be ready
    await this.waitForDebugger(debugPort);
    
    // Connect to the debugger
    await this.connectToDebugger(debugPort);
    
    // Enable debugging domains
    await this.initialize();
  }

  /**
   * Wait for Node.js debugger to be ready
   */
  private async waitForDebugger(port: number, maxRetries = 50): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const info = await this.getDebuggerInfo(port);
        if (info.length > 0) return;
      } catch {
        // Ignore errors while waiting
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Debugger failed to start');
  }

  /**
   * Get debugger connection info
   */
  private async getDebuggerInfo(port: number): Promise<InspectorInfo[]> {
    return new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/json/list`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  }

  /**
   * Connect to Node.js debugger via WebSocket
   */
  private async connectToDebugger(port: number): Promise<void> {
    const info = await this.getDebuggerInfo(port);
    if (info.length === 0) {
      throw new Error('No debugger targets found');
    }

    const wsUrl = info[0].webSocketDebuggerUrl;
    
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.on('open', () => {
        this.setupMessageHandling();
        resolve();
      });
      
      this.ws.on('error', reject);
    });
  }

  /**
   * Setup WebSocket message handling
   */
  private setupMessageHandling(): void {
    if (!this.ws) return;

    this.ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      
      if (message.method) {
        this.handleCDPEvent(message.method, message.params);
      }
    });

    this.ws.on('close', () => {
      this.emit('terminated', {});
      this.cleanup();
    });
  }

  /**
   * Initialize debugging domains
   */
  private async initialize(): Promise<void> {
    await this.sendCDP('Debugger.enable');
    await this.sendCDP('Runtime.enable');
    await this.sendCDP('Console.enable');
    
    // Don't pause on exceptions by default
    await this.sendCDP('Debugger.setPauseOnExceptions', {
      state: 'none'
    });
    
    this.emit('initialized');
  }

  /**
   * Handle CDP events and convert to DAP
   */
  private handleCDPEvent(method: string, params: any): void {
    switch (method) {
      case 'Debugger.scriptParsed':
        if (params.url && !params.url.startsWith('node:')) {
          this.scriptIdToPath.set(params.scriptId, params.url);
        }
        break;

      case 'Debugger.paused':
        this.callFrames = params.callFrames || [];
        this.emit('stopped', {
          reason: this.mapStopReason(params.reason),
          threadId: 1,
          allThreadsStopped: true
        });
        break;

      case 'Debugger.resumed':
        this.callFrames = [];
        this.emit('continued', {
          threadId: 1,
          allThreadsContinued: true
        });
        break;

      case 'Runtime.consoleAPICalled':
        const output = params.args
          ?.map((arg: any) => this.formatValue(arg))
          .join(' ') || '';
        
        this.emit('output', {
          category: 'console',
          output: output + '\n'
        });
        break;

      case 'Runtime.exceptionThrown':
        this.emit('output', {
          category: 'stderr',
          output: `Exception: ${params.exceptionDetails?.text || 'Unknown error'}\n`
        });
        break;
    }
  }

  /**
   * Send CDP command
   */
  private async sendCDP(method: string, params?: any): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to debugger');
    }

    const id = this.messageId++;
    const message = { id, method, params };
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.ws?.removeListener('message', handler);
        reject(new Error(`Timeout waiting for response to ${method}`));
      }, 5000);

      const handler = (data: Buffer) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          clearTimeout(timeout);
          this.ws?.removeListener('message', handler);
          
          if (response.error) {
            reject(new Error(response.error.message));
          } else {
            resolve(response.result);
          }
        }
      };
      
      this.ws.on('message', handler);
      this.ws.send(JSON.stringify(message));
    });
  }

  /**
   * Set breakpoints
   */
  async setBreakpoints(filePath: string, lines: number[]): Promise<number[]> {
    // Clear existing breakpoints for this file
    for (const [bpId, dapId] of this.breakpointIdToDAP.entries()) {
      if (bpId.startsWith(filePath)) {
        await this.sendCDP('Debugger.removeBreakpoint', {
          breakpointId: bpId.split(':')[1]
        });
        this.breakpointIdToDAP.delete(bpId);
      }
    }

    const breakpointIds: number[] = [];
    
    for (const line of lines) {
      try {
        const result = await this.sendCDP('Debugger.setBreakpointByUrl', {
          url: path.resolve(filePath),
          lineNumber: line - 1,  // CDP uses 0-based lines
          columnNumber: 0
        });
        
        if (result.breakpointId) {
          const dapId = this.dapBreakpointId++;
          this.breakpointIdToDAP.set(`${filePath}:${result.breakpointId}`, dapId);
          breakpointIds.push(dapId);
        }
      } catch (e) {
        // Breakpoint failed to set
        breakpointIds.push(0);
      }
    }
    
    return breakpointIds;
  }

  /**
   * Get stack trace
   */
  getStackTrace(): any[] {
    return this.callFrames.map((frame, index) => {
      const location = frame.location;
      const scriptPath = this.scriptIdToPath.get(location.scriptId) || 'unknown';
      
      return {
        id: index,
        name: frame.functionName || '<anonymous>',
        source: {
          path: scriptPath
        },
        line: location.lineNumber + 1,  // Convert to 1-based
        column: location.columnNumber + 1
      };
    });
  }

  /**
   * Get scopes for a frame
   */
  async getScopes(frameId: number): Promise<any[]> {
    if (frameId >= this.callFrames.length) {
      return [];
    }

    const frame = this.callFrames[frameId];
    const scopes: any[] = [];

    // Add local scope
    if (frame.this || frame.scopeChain) {
      scopes.push({
        name: 'Locals',
        variablesReference: this.scopeIdCounter++,
        expensive: false
      });
    }

    return scopes;
  }

  /**
   * Get variables
   */
  async getVariables(variablesReference: number): Promise<any[]> {
    // This is a simplified implementation
    // In a real adapter, you'd need to track scope references properly
    const variables: any[] = [];
    
    // For now, just return some example variables
    if (this.callFrames.length > 0) {
      const frame = this.callFrames[0];
      
      // Evaluate common variables in the frame
      try {
        const result = await this.sendCDP('Debugger.evaluateOnCallFrame', {
          callFrameId: frame.callFrameId,
          expression: 'this',
          returnByValue: false
        });
        
        if (result.result && result.result.type !== 'undefined') {
          variables.push({
            name: 'this',
            value: this.formatValue(result.result),
            type: result.result.type,
            variablesReference: 0
          });
        }
      } catch {
        // Ignore evaluation errors
      }
    }
    
    return variables;
  }

  /**
   * Evaluate expression
   */
  async evaluate(expression: string, frameId?: number): Promise<string> {
    let result;
    
    if (frameId !== undefined && frameId < this.callFrames.length) {
      // Evaluate in specific frame
      result = await this.sendCDP('Debugger.evaluateOnCallFrame', {
        callFrameId: this.callFrames[frameId].callFrameId,
        expression,
        returnByValue: true
      });
    } else {
      // Global evaluation
      result = await this.sendCDP('Runtime.evaluate', {
        expression,
        returnByValue: true
      });
    }
    
    return this.formatValue(result.result);
  }

  /**
   * Continue execution
   */
  async continue(): Promise<void> {
    await this.sendCDP('Debugger.resume');
  }

  /**
   * Step over
   */
  async stepOver(): Promise<void> {
    await this.sendCDP('Debugger.stepOver');
  }

  /**
   * Step into
   */
  async stepInto(): Promise<void> {
    await this.sendCDP('Debugger.stepInto');
  }

  /**
   * Step out
   */
  async stepOut(): Promise<void> {
    await this.sendCDP('Debugger.stepOut');
  }

  /**
   * Pause execution
   */
  async pause(): Promise<void> {
    await this.sendCDP('Debugger.pause');
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
    }
    if (this.process) {
      this.process.kill();
    }
    this.cleanup();
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.ws = null;
    this.process = null;
    this.scriptIdToPath.clear();
    this.breakpointIdToDAP.clear();
    this.callFrames = [];
    this.variableRefToObject.clear();
  }

  /**
   * Format CDP value for display
   */
  private formatValue(value: any): string {
    if (!value) return 'undefined';
    
    if (value.value !== undefined) {
      return String(value.value);
    }
    
    if (value.description) {
      return value.description;
    }
    
    if (value.type) {
      return `<${value.type}>`;
    }
    
    return String(value);
  }

  /**
   * Map CDP stop reason to DAP
   */
  private mapStopReason(cdpReason: string): string {
    const reasonMap: Record<string, string> = {
      'debugCommand': 'pause',
      'breakpoint': 'breakpoint',
      'exception': 'exception',
      'step': 'step',
      'other': 'pause'
    };
    
    return reasonMap[cdpReason] || 'pause';
  }
}

// Example usage
if (require.main === module) {
  async function example() {
    const adapter = new MinimalNodeDAPAdapter();
    
    // Listen for events
    adapter.on('initialized', () => {
      console.log('Debugger initialized');
    });
    
    adapter.on('stopped', (event) => {
      console.log('Stopped:', event);
    });
    
    adapter.on('output', (event) => {
      process.stdout.write(`[${event.category}] ${event.output}`);
    });
    
    // Create a test file
    const testFile = path.join(__dirname, 'test-program.js');
    fs.writeFileSync(testFile, `
console.log('Starting program');

function add(a, b) {
  console.log('Adding', a, 'and', b);
  return a + b;
}

const result = add(2, 3);
console.log('Result:', result);

console.log('Program finished');
    `);
    
    // Launch the program
    await adapter.launch(testFile, [], {
      stopOnEntry: true
    });
    
    // Set a breakpoint
    await adapter.setBreakpoints(testFile, [8]);
    
    // Continue execution
    await adapter.continue();
    
    // Wait a bit for program to finish
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Cleanup
    adapter.disconnect();
    fs.unlinkSync(testFile);
  }
  
  example().catch(console.error);
}

export default MinimalNodeDAPAdapter;