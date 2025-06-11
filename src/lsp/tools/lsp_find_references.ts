import { z } from "zod";
import { type Result, ok, err } from "neverthrow";
import { readFileSync } from "fs";
import { relative, resolve } from "path";
import { getActiveClient } from "../lsp_client.ts";
import { parseLineNumber, findSymbolInLine } from "../text_utils.ts";
import type { ToolDef } from "../../mcp/types.ts";

const schema = z.object({
  root: z.string().describe("Root directory for resolving relative paths"),
  filePath: z
    .string()
    .describe("File path containing the symbol (relative to root)"),
  line: z
    .union([z.number(), z.string()])
    .describe("Line number (1-based) or string to match in the line"),
  symbolName: z.string().describe("Name of the symbol to find references for"),
});

type FindReferencesRequest = z.infer<typeof schema>;

interface Reference {
  filePath: string;
  line: number;
  column: number;
  text: string;
  preview: string;
}

interface FindReferencesSuccess {
  message: string;
  references: Reference[];
}

/**
 * Finds all references to a TypeScript symbol using LSP
 */
async function findReferencesWithLSP(
  request: FindReferencesRequest
): Promise<Result<FindReferencesSuccess, string>> {
  try {
    const client = getActiveClient();
    
    // Read file content
    const absolutePath = resolve(request.root, request.filePath);
    const fileContent = readFileSync(absolutePath, "utf-8");
    const fileUri = `file://${absolutePath}`;
    
    // Parse line number
    const lines = fileContent.split("\n");
    const lineResult = parseLineNumber(lines, request.line);
    if ("error" in lineResult) {
      return err(`${lineResult.error} in ${request.filePath}`);
    }
    
    const targetLine = lineResult.lineIndex;
    
    // Find symbol position in line
    const lineText = lines[targetLine];
    const symbolResult = findSymbolInLine(lineText, request.symbolName);
    if ("error" in symbolResult) {
      return err(`${symbolResult.error} on line ${targetLine + 1}`);
    }
    
    const symbolPosition = symbolResult.characterIndex;
    
    // Open document in LSP
    client.openDocument(fileUri, fileContent);
    
    // Give LSP server time to process the document
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    // Find references
    const locations = await client.findReferences(fileUri, {
      line: targetLine,
      character: symbolPosition,
    });

    // Convert LSP locations to our Reference format
    const references: Reference[] = [];

    for (const location of locations) {
      const refPath = location.uri.replace("file://", "");
      const refContent = readFileSync(refPath, "utf-8");
      const refLines = refContent.split("\n");

      // Get the text at the reference location
      const startLine = location.range.start.line;
      const startCol = location.range.start.character;
      const endCol = location.range.end.character;
      const refLineText = refLines[startLine] || "";
      const text = refLineText.substring(startCol, endCol);

      // Create preview with context
      const prevLine = startLine > 0 ? refLines[startLine - 1] : "";
      const nextLine =
        startLine < refLines.length - 1 ? refLines[startLine + 1] : "";
      const preview = [
        prevLine && `${startLine}: ${prevLine}`,
        `${startLine + 1}: ${refLineText}`,
        nextLine && `${startLine + 2}: ${nextLine}`,
      ]
        .filter(Boolean)
        .join("\n");

      references.push({
        filePath: relative(request.root, refPath),
        line: startLine + 1, // Convert to 1-based
        column: startCol + 1, // Convert to 1-based
        text,
        preview,
      });
    }

    return ok({
      message: `Found ${references.length} reference${
        references.length === 1 ? "" : "s"
      } to "${request.symbolName}"`,
      references,
    });
  } catch (error) {
    return err(error instanceof Error ? error.message : String(error));
  }
}

export const lspFindReferencesTool: ToolDef<typeof schema> = {
  name: "lsp_find_references",
  description: "Find all references to symbol across the codebase using LSP",
  schema,
  handler: async (args) => {
    const result = await findReferencesWithLSP(args);
    if (result.isOk()) {
      const messages = [result.value.message];

      if (result.value.references.length > 0) {
        messages.push(
          result.value.references
            .map(
              (ref) =>
                `\n${ref.filePath}:${ref.line}:${ref.column}\n${ref.preview}`
            )
            .join("\n")
        );
      }

      return messages.join("\n\n");
    } else {
      throw new Error(result.error);
    }
  },
};
