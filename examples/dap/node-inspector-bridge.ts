/**
 * Node.js Inspector to DAP Bridge Example
 * 
 * This demonstrates how to create a lightweight bridge between
 * Node.js Inspector Protocol (Chrome DevTools Protocol) and DAP
 * without using external dependencies like vscode-js-debug
 */

import * as inspector from "node:inspector";
import WebSocket from "ws";

// Chrome DevTools Protocol types
interface CDPMessage {
  id?: number;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}

interface CDPBreakpoint {
  lineNumber: number;
  columnNumber?: number;
  condition?: string;
}

// DAP to CDP mapping
class InspectorToDAPBridge {
  private session: inspector.Session;
  private ws: WebSocket | null = null;
  private messageId = 1;
  private breakpointIdMap = new Map<string, string>();
  private scriptIdToPath = new Map<string, string>();
  
  constructor() {
    this.session = new inspector.Session();
  }

  /**
   * Connect to Node.js inspector
   */
  connect(): void {
    this.session.connect();
    this.setupEventHandlers();
  }

  /**
   * Alternative: Connect via WebSocket to external Node.js process
   */
  async connectWebSocket(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);
      
      this.ws.on('open', () => {
        console.log('Connected to Node.js Inspector via WebSocket');
        resolve();
      });
      
      this.ws.on('message', (data) => {
        const message = JSON.parse(data.toString()) as CDPMessage;
        this.handleCDPMessage(message);
      });
      
      this.ws.on('error', reject);
    });
  }

  /**
   * Setup CDP event handlers
   */
  private setupEventHandlers(): void {
    // Script parsed event - track script IDs to file paths
    this.session.on('Debugger.scriptParsed', (params) => {
      if (params.url && !params.url.startsWith('node:')) {
        this.scriptIdToPath.set(params.scriptId, params.url);
      }
    });

    // Paused event - convert to DAP stopped event
    this.session.on('Debugger.paused', (params) => {
      const dapEvent = this.convertPausedToStopped(params);
      this.emitDAPEvent('stopped', dapEvent);
    });

    // Console output - convert to DAP output event
    this.session.on('Runtime.consoleAPICalled', (params) => {
      const dapEvent = this.convertConsoleToOutput(params);
      this.emitDAPEvent('output', dapEvent);
    });
  }

  /**
   * Initialize debugging (DAP initialize + CDP enable)
   */
  async initialize(): Promise<void> {
    // Enable necessary CDP domains
    await this.sendCDPCommand('Debugger.enable');
    await this.sendCDPCommand('Runtime.enable');
    await this.sendCDPCommand('Console.enable');
    
    // Set breakpoint behavior
    await this.sendCDPCommand('Debugger.setPauseOnExceptions', {
      state: 'none'
    });
  }

  /**
   * Launch a script for debugging
   */
  async launch(script: string, stopOnEntry = false): Promise<void> {
    if (stopOnEntry) {
      await this.sendCDPCommand('Debugger.pause');
    }
    
    // In a real implementation, you would spawn the Node.js process here
    // with --inspect-brk flag and connect to it
    console.log(`Would launch: node --inspect-brk ${script}`);
  }

  /**
   * Set breakpoints (DAP to CDP conversion)
   */
  async setBreakpoints(filePath: string, lines: number[]): Promise<void> {
    // First, remove all existing breakpoints for this file
    for (const [key, bpId] of this.breakpointIdMap.entries()) {
      if (key.startsWith(filePath)) {
        await this.sendCDPCommand('Debugger.removeBreakpoint', {
          breakpointId: bpId
        });
        this.breakpointIdMap.delete(key);
      }
    }

    // Set new breakpoints
    for (const line of lines) {
      const result = await this.sendCDPCommand('Debugger.setBreakpointByUrl', {
        url: filePath,
        lineNumber: line - 1, // CDP uses 0-based lines
        columnNumber: 0
      });
      
      if (result.breakpointId) {
        this.breakpointIdMap.set(`${filePath}:${line}`, result.breakpointId);
      }
    }
  }

  /**
   * Get stack trace (CDP to DAP conversion)
   */
  async getStackTrace(threadId?: number): Promise<any[]> {
    // In CDP, there's no thread concept for single-threaded JS
    // We'd need to track the current call frames from the last pause event
    return [];
  }

  /**
   * Continue execution
   */
  async continue(): Promise<void> {
    await this.sendCDPCommand('Debugger.resume');
  }

  /**
   * Step over
   */
  async stepOver(): Promise<void> {
    await this.sendCDPCommand('Debugger.stepOver');
  }

  /**
   * Step into
   */
  async stepInto(): Promise<void> {
    await this.sendCDPCommand('Debugger.stepInto');
  }

  /**
   * Step out
   */
  async stepOut(): Promise<void> {
    await this.sendCDPCommand('Debugger.stepOut');
  }

  /**
   * Evaluate expression
   */
  async evaluate(expression: string, frameId?: number): Promise<string> {
    const params: any = {
      expression,
      includeCommandLineAPI: true,
      generatePreview: true
    };
    
    if (frameId !== undefined) {
      params.callFrameId = frameId.toString();
    }
    
    const result = await this.sendCDPCommand('Debugger.evaluateOnCallFrame', params);
    return result.result?.value || result.result?.description || '';
  }

  /**
   * Send CDP command
   */
  private async sendCDPCommand(method: string, params?: any): Promise<any> {
    if (this.ws) {
      // WebSocket mode
      const id = this.messageId++;
      const message = { id, method, params };
      
      return new Promise((resolve, reject) => {
        const handler = (data: WebSocket.Data) => {
          const response = JSON.parse(data.toString()) as CDPMessage;
          if (response.id === id) {
            this.ws!.off('message', handler);
            if (response.error) {
              reject(new Error(response.error.message));
            } else {
              resolve(response.result);
            }
          }
        };
        
        this.ws!.on('message', handler);
        this.ws!.send(JSON.stringify(message));
      });
    } else {
      // Direct session mode
      return new Promise((resolve, reject) => {
        this.session.post(method, params, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
    }
  }

  /**
   * Convert CDP paused event to DAP stopped event
   */
  private convertPausedToStopped(cdpParams: any): any {
    const reason = this.mapPauseReason(cdpParams.reason);
    
    return {
      reason,
      threadId: 1, // Single thread for Node.js
      allThreadsStopped: true,
      hitBreakpointIds: cdpParams.hitBreakpoints
    };
  }

  /**
   * Convert CDP console event to DAP output event
   */
  private convertConsoleToOutput(cdpParams: any): any {
    const text = cdpParams.args
      ?.map((arg: any) => arg.value || arg.description || '')
      .join(' ') || '';
    
    return {
      category: cdpParams.type || 'console',
      output: text + '\n'
    };
  }

  /**
   * Map CDP pause reason to DAP stop reason
   */
  private mapPauseReason(cdpReason: string): string {
    const reasonMap: Record<string, string> = {
      'debugCommand': 'pause',
      'breakpoint': 'breakpoint',
      'exception': 'exception',
      'step': 'step',
      'other': 'pause'
    };
    
    return reasonMap[cdpReason] || 'pause';
  }

  /**
   * Emit DAP event (would send to DAP client)
   */
  private emitDAPEvent(event: string, body: any): void {
    console.log(`DAP Event: ${event}`, body);
    // In a real implementation, this would send the event to the DAP client
  }

  /**
   * Handle incoming CDP message (for WebSocket mode)
   */
  private handleCDPMessage(message: CDPMessage): void {
    if (message.method) {
      // This is an event
      console.log(`CDP Event: ${message.method}`, message.params);
    }
  }

  /**
   * Disconnect
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
    } else {
      this.session.disconnect();
    }
  }
}

// Example usage
async function example() {
  const bridge = new InspectorToDAPBridge();
  
  // Option 1: Connect to current process
  bridge.connect();
  
  // Option 2: Connect to external process
  // await bridge.connectWebSocket('ws://127.0.0.1:9229/some-uuid');
  
  await bridge.initialize();
  
  // Set breakpoints
  await bridge.setBreakpoints('/path/to/script.js', [10, 20, 30]);
  
  // Continue execution
  await bridge.continue();
  
  // Evaluate expression
  const result = await bridge.evaluate('2 + 2');
  console.log('Evaluation result:', result);
}

// Run example if this file is executed directly
if (require.main === module) {
  example().catch(console.error);
}

export { InspectorToDAPBridge };