import { type Project, type SourceFile, Node, SyntaxKind } from "ts-morph";
import { type Result, ok, err } from "neverthrow";

export interface DeleteSymbolRequest {
  filePath: string;
  line: number;
  symbolName: string;
}

export interface DeleteSymbolSuccess {
  message: string;
  removedFromFiles: string[];
}

/**
 * ファイルパスと行番号、シンボル名を指定してシンボルを削除
 */
export async function deleteSymbol(
  project: Project,
  request: DeleteSymbolRequest
): Promise<Result<DeleteSymbolSuccess, string>> {
  try {
    const sourceFile = project.getSourceFile(request.filePath);
    if (!sourceFile) {
      return err(`File not found: ${request.filePath}`);
    }

    const node = findSymbolAtLine(sourceFile, request.line, request.symbolName);
    if (!node) {
      return err(
        `Symbol "${request.symbolName}" not found at line ${String(request.line)}`
      );
    }

    const removedFromFiles: string[] = [sourceFile.getFilePath()];

    // Get the declaration node to remove
    const declaration = getDeclarationNode(node);
    if (!declaration) {
      return err(`Cannot find declaration for symbol "${request.symbolName}"`);
    }

    // Remove the declaration
    if (Node.isVariableDeclaration(declaration)) {
      // For variable declarations, we need to remove the variable statement
      const variableStatement = declaration.getFirstAncestorByKind(
        SyntaxKind.VariableStatement
      );
      if (variableStatement && Node.isVariableStatement(variableStatement)) {
        const declarations = variableStatement.getDeclarations();
        if (declarations.length === 1) {
          // If this is the only declaration, remove the entire statement
          variableStatement.remove();
        } else {
          // Otherwise, just remove this specific declaration
          declaration.remove();
        }
      }
    } else if (typeof (declaration as any).remove === "function") {
      // For other declarations (classes, functions, interfaces, etc.)
      (declaration as any).remove();
    } else {
      return err(`Cannot remove node of type ${declaration.getKindName()}`);
    }

    // Save the project
    await project.save();

    return ok({
      message: `Successfully removed symbol "${request.symbolName}"`,
      removedFromFiles,
    });
  } catch (error) {
    return err(error instanceof Error ? error.message : String(error));
  }
}

/**
 * 指定された行とシンボル名に一致するノードを探す
 */
function findSymbolAtLine(
  sourceFile: SourceFile,
  line: number,
  symbolName: string
): Node | undefined {
  let foundNode: Node | undefined;

  sourceFile.forEachDescendant((node) => {
    if (foundNode) return;

    const startLine = sourceFile.getLineAndColumnAtPos(node.getStart()).line;
    const endLine = sourceFile.getLineAndColumnAtPos(node.getEnd()).line;

    if (line >= startLine && line <= endLine) {
      if (Node.isIdentifier(node) && node.getText() === symbolName) {
        foundNode = node;
        return;
      }

      if (hasGetNameMethod(node)) {
        try {
          if ((node as any).getName() === symbolName) {
            foundNode = node;
            return;
          }
        } catch {
          // getName()が使えないノードは無視
        }
      }

      if (Node.isVariableDeclaration(node)) {
        const nameNode = node.getNameNode();
        if (Node.isIdentifier(nameNode) && nameNode.getText() === symbolName) {
          foundNode = nameNode;
          return;
        }
      }
    }
  });

  return foundNode;
}

/**
 * Get the declaration node from any node
 */
function getDeclarationNode(node: Node): Node | undefined {
  if (Node.isIdentifier(node)) {
    const parent = node.getParent();
    if (Node.isVariableDeclaration(parent)) {
      return parent;
    }
    if (hasGetNameMethod(parent) && isDeclarationNode(parent)) {
      return parent;
    }
  }

  if (isDeclarationNode(node)) {
    return node;
  }

  return undefined;
}

/**
 * Check if node is a declaration node
 */
function isDeclarationNode(node: Node): boolean {
  return (
    Node.isClassDeclaration(node) ||
    Node.isFunctionDeclaration(node) ||
    Node.isInterfaceDeclaration(node) ||
    Node.isTypeAliasDeclaration(node) ||
    Node.isEnumDeclaration(node) ||
    Node.isVariableDeclaration(node)
  );
}

/**
 * Check if node has getName method
 */
function hasGetNameMethod(node: Node): boolean {
  return (
    Node.isClassDeclaration(node) ||
    Node.isFunctionDeclaration(node) ||
    Node.isInterfaceDeclaration(node) ||
    Node.isTypeAliasDeclaration(node) ||
    Node.isEnumDeclaration(node) ||
    Node.isMethodDeclaration(node) ||
    Node.isPropertyDeclaration(node) ||
    Node.isGetAccessorDeclaration(node) ||
    Node.isSetAccessorDeclaration(node)
  );
}
