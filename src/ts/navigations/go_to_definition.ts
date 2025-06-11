import { type Project, Node, ts } from "ts-morph";
import { type Result, ok, err } from "neverthrow";

export interface GoToDefinitionRequest {
  filePath: string;
  line: number;
  column: number;
}

export interface Definition {
  filePath: string;
  line: number;
  column: number;
  text: string;
  lineText: string;
  kind: string;
}

export interface GoToDefinitionSuccess {
  message: string;
  definitions: Definition[];
  symbol: {
    name: string;
    kind: string;
  };
}

export function goToDefinition(
  project: Project,
  request: GoToDefinitionRequest
): Result<GoToDefinitionSuccess, string> {
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
    // Find the identifier node
    const identifier = Node.isIdentifier(node) ? node : node.getFirstDescendantByKind(ts.SyntaxKind.Identifier);
    if (!identifier) {
      return err(`No identifier found at position ${String(request.line)}:${String(request.column)}`);
    }

    // Get definition nodes
    const definitionNodes = identifier.getDefinitionNodes();

    if (!definitionNodes || definitionNodes.length === 0) {
      return ok({
        message: `No definitions found for symbol "${symbolName}"`,
        definitions: [],
        symbol: {
          name: symbolName,
          kind: symbolKind
        }
      });
    }

    const definitions: Definition[] = [];

    for (const defNode of definitionNodes) {
      const defSourceFile = defNode.getSourceFile();
      const start = defNode.getStart();
      const startLineAndCol = defSourceFile.getLineAndColumnAtPos(start);
      
      // Get line text
      const fullText = defSourceFile.getFullText();
      const lines = fullText.split('\n');
      const lineText = lines[startLineAndCol.line - 1] || '';

      definitions.push({
        filePath: defSourceFile.getFilePath(),
        line: startLineAndCol.line,
        column: startLineAndCol.column,
        text: defNode.getText(),
        lineText: lineText.trim(),
        kind: defNode.getKindName()
      });
    }

    return ok({
      message: `Found ${definitions.length} definition${definitions.length === 1 ? '' : 's'} for symbol "${symbolName}"`,
      definitions,
      symbol: {
        name: symbolName,
        kind: symbolKind
      }
    });
  } catch (error) {
    return err(error instanceof Error ? error.message : String(error));
  }
}