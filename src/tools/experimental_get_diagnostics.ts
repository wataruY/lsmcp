import { type Result, ok, err } from "neverthrow";
import { readFileSync } from "fs";
import { resolve } from "path";
import { type McpToolResult, formatMcpResult } from "./lsp_common.ts";
import { createLSPClient } from "../_experimental/lsp_client.ts";

interface GetDiagnosticsRequest {
  root: string;
  filePath: string;
  virtualContent?: string;
}

interface Diagnostic {
  severity: "error" | "warning" | "information" | "hint";
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  message: string;
  source?: string;
  code?: string | number;
}

interface GetDiagnosticsSuccess {
  message: string;
  diagnostics: Diagnostic[];
}

// LSP Diagnostic severity mapping
const SEVERITY_MAP: Record<number, Diagnostic["severity"]> = {
  1: "error",
  2: "warning",
  3: "information",
  4: "hint",
};

interface LSPDiagnostic {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  severity?: number;
  code?: string | number;
  source?: string;
  message: string;
}

/**
 * Gets diagnostics for a TypeScript file using LSP
 */
async function getDiagnosticsWithLSP(
  request: GetDiagnosticsRequest
): Promise<Result<GetDiagnosticsSuccess, string>> {
  const client = createLSPClient(request.root);

  try {
    // Start LSP server
    await client.start();

    // Read file content or use virtual content
    const absolutePath = resolve(request.root, request.filePath);
    const fileContent =
      request.virtualContent || readFileSync(absolutePath, "utf-8");
    const fileUri = `file://${absolutePath}`;

    // Open document in LSP
    client.openDocument(fileUri, fileContent);

    // Give LSP server time to process and compute diagnostics
    await new Promise<void>((resolve) => setTimeout(resolve, 1500));

    // Get diagnostics from LSP
    const lspDiagnostics = client.getDiagnostics(fileUri) as LSPDiagnostic[];

    // If using virtual content and no diagnostics yet, update the document
    // to trigger diagnostics
    if (request.virtualContent && lspDiagnostics.length === 0) {
      client.updateDocument(fileUri, fileContent, 2);
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
      const updatedDiagnostics = client.getDiagnostics(
        fileUri
      ) as LSPDiagnostic[];
      if (updatedDiagnostics.length > 0) {
        lspDiagnostics.push(...updatedDiagnostics);
      }
    }

    // Convert LSP diagnostics to our format
    const diagnostics: Diagnostic[] = lspDiagnostics.map((diag) => ({
      severity: SEVERITY_MAP[diag.severity ?? 1] ?? "error",
      line: diag.range.start.line + 1, // Convert to 1-based
      column: diag.range.start.character + 1,
      endLine: diag.range.end.line + 1,
      endColumn: diag.range.end.character + 1,
      message: diag.message,
      source: diag.source,
      code: diag.code,
    }));

    await client.stop();

    const errorCount = diagnostics.filter((d) => d.severity === "error").length;
    const warningCount = diagnostics.filter(
      (d) => d.severity === "warning"
    ).length;

    return ok({
      message: `Found ${errorCount} error${
        errorCount !== 1 ? "s" : ""
      } and ${warningCount} warning${warningCount !== 1 ? "s" : ""} in ${
        request.filePath
      }`,
      diagnostics,
    });
  } catch (error) {
    await client.stop().catch(() => {});
    return err(error instanceof Error ? error.message : String(error));
  }
}

export const experimentalGetDiagnosticsTool = {
  name: "experimental_get_diagnostics",
  description:
    "Get TypeScript diagnostics (errors, warnings) for a file using LSP",
  inputSchema: {
    type: "object",
    properties: {
      root: {
        type: "string",
        description: "Root directory for resolving relative paths",
      },
      filePath: {
        type: "string",
        description: "File path to check for diagnostics (relative to root)",
      },
      virtualContent: {
        type: "string",
        description:
          "Virtual content to use for diagnostics instead of file content",
      },
    },
    required: ["root", "filePath"],
  },
  handler: async (args: GetDiagnosticsRequest): Promise<McpToolResult> => {
    const result = await getDiagnosticsWithLSP(args);
    if (result.isOk()) {
      const messages = [result.value.message];

      if (result.value.diagnostics.length > 0) {
        for (const diag of result.value.diagnostics) {
          const codeInfo = diag.code ? ` [${diag.code}]` : "";
          const sourceInfo = diag.source ? ` (${diag.source})` : "";
          messages.push(
            `\n${diag.severity.toUpperCase()}: ${
              diag.message
            }${codeInfo}${sourceInfo}\n` +
              `  at ${args.filePath}:${diag.line}:${diag.column}`
          );
        }
      }

      return formatMcpResult(true, messages);
    } else {
      return formatMcpResult(false, [`Error: ${result.error}`]);
    }
  },
};
