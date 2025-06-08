import { Project, DiagnosticCategory } from "ts-morph";
import { Result, ok, err } from "neverthrow";

export interface GetDiagnosticsRequest {
  filePaths: string[];
}

export interface Diagnostic {
  filePath: string;
  line: number;
  column: number;
  message: string;
  category: string;
  code: number;
  length: number;
}

export interface GetDiagnosticsSuccess {
  message: string;
  diagnostics: Diagnostic[];
  summary: {
    errors: number;
    warnings: number;
    suggestions: number;
    messages: number;
  };
  fileCount: number;
}

function categoryToString(category: DiagnosticCategory): string {
  switch (category) {
    case DiagnosticCategory.Error:
      return "error";
    case DiagnosticCategory.Warning:
      return "warning";
    case DiagnosticCategory.Suggestion:
      return "suggestion";
    case DiagnosticCategory.Message:
      return "message";
    default:
      return "unknown";
  }
}

export function getDiagnostics(
  project: Project,
  request: GetDiagnosticsRequest
): Result<GetDiagnosticsSuccess, string> {
  if (request.filePaths.length === 0) {
    return err("No file paths provided");
  }

  try {
    const results: Diagnostic[] = [];
    const summary = {
      errors: 0,
      warnings: 0,
      suggestions: 0,
      messages: 0,
    };
    let processedFiles = 0;

    for (const filePath of request.filePaths) {
      const sourceFile = project.getSourceFile(filePath);
      if (!sourceFile) {
        // Skip files that are not found
        continue;
      }
      
      processedFiles++;

      // Get pre-emit diagnostics for this specific file
      const diagnostics = sourceFile.getPreEmitDiagnostics();

      for (const diagnostic of diagnostics) {
        const diagSourceFile = diagnostic.getSourceFile();
        
        // Skip diagnostics from other files (e.g., imported modules)
        if (diagSourceFile && diagSourceFile.getFilePath() !== filePath) {
          continue;
        }

        const start = diagnostic.getStart();
        const length = diagnostic.getLength() || 0;
        const category = diagnostic.getCategory();
        const categoryStr = categoryToString(category);

        // Update summary counts
        switch (category) {
          case DiagnosticCategory.Error:
            summary.errors++;
            break;
          case DiagnosticCategory.Warning:
            summary.warnings++;
            break;
          case DiagnosticCategory.Suggestion:
            summary.suggestions++;
            break;
          case DiagnosticCategory.Message:
            summary.messages++;
            break;
        }

        let line = 1;
        let column = 1;

        if (start !== undefined && diagSourceFile) {
          const lineAndCol = diagSourceFile.getLineAndColumnAtPos(start);
          line = lineAndCol.line;
          column = lineAndCol.column;
        }

        results.push({
          filePath: diagSourceFile?.getFilePath() || filePath,
          line,
          column,
          message: diagnostic.getMessageText().toString(),
          category: categoryStr,
          code: diagnostic.getCode(),
          length,
        });
      }
    }

    if (processedFiles === 0) {
      return err("No valid source files found");
    }

    const totalCount = results.length;
    const summaryParts: string[] = [];
    
    if (summary.errors > 0) {
      summaryParts.push(`${summary.errors} error${summary.errors > 1 ? 's' : ''}`);
    }
    if (summary.warnings > 0) {
      summaryParts.push(`${summary.warnings} warning${summary.warnings > 1 ? 's' : ''}`);
    }
    if (summary.suggestions > 0) {
      summaryParts.push(`${summary.suggestions} suggestion${summary.suggestions > 1 ? 's' : ''}`);
    }
    if (summary.messages > 0) {
      summaryParts.push(`${summary.messages} message${summary.messages > 1 ? 's' : ''}`);
    }

    const summaryText = summaryParts.length > 0 
      ? summaryParts.join(", ")
      : "No diagnostics";

    return ok({
      message: `Found ${totalCount} diagnostic${totalCount === 1 ? '' : 's'} in ${processedFiles} file${processedFiles === 1 ? '' : 's'}: ${summaryText}`,
      diagnostics: results,
      summary,
      fileCount: processedFiles,
    });
  } catch (error) {
    return err(error instanceof Error ? error.message : String(error));
  }
}