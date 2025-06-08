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
    let processedFiles = 0;
    const allDiagnostics: any[] = [];

    for (const filePath of request.filePaths) {
      const sourceFile = project.getSourceFile(filePath);
      if (!sourceFile) {
        // Skip files that are not found
        continue;
      }
      
      processedFiles++;

      // Get pre-emit diagnostics for this specific file
      const diagnostics = sourceFile.getPreEmitDiagnostics();
      allDiagnostics.push(...diagnostics);

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


    // Use ts-morph's built-in formatting for the message
    const message = allDiagnostics.length > 0
      ? project.formatDiagnosticsWithColorAndContext(allDiagnostics)
      : `No diagnostics found in ${processedFiles} file${processedFiles === 1 ? '' : 's'}.`;

    return ok({
      message,
      diagnostics: results,
      fileCount: processedFiles,
    });
  } catch (error) {
    return err(error instanceof Error ? error.message : String(error));
  }
}