import { type Project, Node, ts } from "ts-morph";
import { type Result, ok, err } from "neverthrow";

export interface FindReferencesRequest {
  filePath: string;
  line: number;
  column: number;
}

export interface Reference {
  filePath: string;
  line: number;
  column: number;
  text: string;
  lineText: string;
}

export interface FindReferencesSuccess {
  message: string;
  references: Reference[];
  symbol: {
    name: string;
    kind: string;
  };
}

export function findReferences(
  project: Project,
  request: FindReferencesRequest
): Result<FindReferencesSuccess, string> {
  const sourceFile = project.getSourceFile(request.filePath);
  if (!sourceFile) {
    return err(`File not found: ${request.filePath}`);
  }

  // Find the position
  const position = sourceFile.compilerNode.getPositionOfLineAndCharacter(
    request.line - 1,
    request.column - 1
  );

  const node = sourceFile.getDescendantAtPos(position);
  if (!node) {
    return err(`No node found at position ${String(request.line)}:${String(request.column)}`);
  }

  const symbol = node.getSymbol();
  if (!symbol) {
    return err(`No symbol found at position ${String(request.line)}:${String(request.column)}`);
  }

  const symbolName = symbol.getName();
  const symbolKind = node.getKindName();

  try {
    // Find references using ts-morph's findReferences
    // We need to use a Node method, not directly on node
    const identifier = Node.isIdentifier(node) ? node : node.getFirstDescendantByKind(ts.SyntaxKind.Identifier);
    if (!identifier) {
      return err(`No identifier found at position ${String(request.line)}:${String(request.column)}`);
    }

    const referencedSymbols = identifier.findReferences();

    if (!referencedSymbols || referencedSymbols.length === 0) {
      return ok({
        message: `No references found for symbol "${symbolName}"`,
        references: [],
        symbol: {
          name: symbolName,
          kind: symbolKind
        }
      });
    }

    const references: Reference[] = [];

    for (const referencedSymbol of referencedSymbols) {
      for (const reference of referencedSymbol.getReferences()) {
        const refSourceFile = reference.getSourceFile();
        const refNode = reference.getNode();
        const start = refNode.getStart();
        const startLineAndCol = refSourceFile.getLineAndColumnAtPos(start);
        
        // Get line text
        const fullText = refSourceFile.getFullText();
        const lines = fullText.split('\n');
        const lineText = lines[startLineAndCol.line - 1] || '';

        references.push({
          filePath: refSourceFile.getFilePath(),
          line: startLineAndCol.line,
          column: startLineAndCol.column,
          text: refNode.getText(),
          lineText: lineText.trim()
        });
      }
    }

    return ok({
      message: `Found ${references.length} reference${references.length === 1 ? '' : 's'} for symbol "${symbolName}"`,
      references,
      symbol: {
        name: symbolName,
        kind: symbolKind
      }
    });
  } catch (error) {
    return err(error instanceof Error ? error.message : String(error));
  }
}