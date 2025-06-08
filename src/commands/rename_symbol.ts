import {
  Project,
  SourceFile,
  Node,
  getCompilerOptionsFromTsConfig,
} from "ts-morph";

export interface RenameRequest {
  filePath: string;
  line: number;
  symbolName: string;
  newName: string;
  renameInComments?: boolean;
  renameInStrings?: boolean;
}

export interface RenameResult {
  success: boolean;
  changedFiles: Array<{
    filePath: string;
    changes: Array<{
      line: number;
      column: number;
      oldText: string;
      newText: string;
    }>;
  }>;
  error?: string;
}

/**
 * プロジェクトを作成または取得
 */
export function createProject(tsConfigPath?: string): Project {
  if (tsConfigPath) {
    const { options, errors } = getCompilerOptionsFromTsConfig(tsConfigPath);
    if (errors.length > 0) {
      throw new Error(
        `Failed to read tsconfig: ${errors
          .map((e) => e.getMessageText())
          .join(", ")}`
      );
    }
    return new Project({
      compilerOptions: options,
      skipAddingFilesFromTsConfig: false,
    });
  }

  return new Project({
    skipAddingFilesFromTsConfig: false,
  });
}

/**
 * ファイルパスと行番号、シンボル名を指定してシンボルのリネームを実行
 */
export async function renameSymbol(
  project: Project,
  request: RenameRequest
): Promise<RenameResult> {
  try {
    // ソースファイルを取得
    const sourceFile = project.getSourceFile(request.filePath);
    if (!sourceFile) {
      return {
        success: false,
        changedFiles: [],
        error: `File not found: ${request.filePath}`,
      };
    }

    // 指定された行のシンボルを探す
    const node = findSymbolAtLine(sourceFile, request.line, request.symbolName);
    if (!node) {
      return {
        success: false,
        changedFiles: [],
        error: `Symbol "${request.symbolName}" not found at line ${request.line}`,
      };
    }

    // リネーム前の状態を記録
    const beforeStates = captureFileStates(project);

    // リネームを実行
    if (Node.isIdentifier(node)) {
      node.rename(request.newName, {
        renameInComments: request.renameInComments || false,
        renameInStrings: request.renameInStrings || false,
      });
    } else if (hasRenameMethod(node)) {
      (node as any).rename(request.newName, {
        renameInComments: request.renameInComments || false,
        renameInStrings: request.renameInStrings || false,
      });
    } else {
      return {
        success: false,
        changedFiles: [],
        error: `Cannot rename node of type ${node.getKindName()}`,
      };
    }

    // 変更を検出
    const changedFiles = detectChanges(project, beforeStates);

    // プロジェクトを保存
    await project.save();

    return {
      success: true,
      changedFiles,
    };
  } catch (error) {
    return {
      success: false,
      changedFiles: [],
      error: error instanceof Error ? error.message : String(error),
    };
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
    // 既に見つかっている場合はスキップ
    if (foundNode) return;

    const startLine = sourceFile.getLineAndColumnAtPos(node.getStart()).line;
    const endLine = sourceFile.getLineAndColumnAtPos(node.getEnd()).line;

    // 指定された行に含まれているかチェック
    if (line >= startLine && line <= endLine) {
      // 識別子の場合
      if (Node.isIdentifier(node) && node.getText() === symbolName) {
        foundNode = node;
        return;
      }

      // 名前付きノードの場合（クラス、関数、変数など）
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

      // 変数宣言の場合
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
 * 全ソースファイルの現在の状態をキャプチャ
 */
function captureFileStates(project: Project): Map<string, string> {
  const states = new Map<string, string>();
  for (const sourceFile of project.getSourceFiles()) {
    states.set(sourceFile.getFilePath(), sourceFile.getFullText());
  }
  return states;
}

/**
 * ファイルの変更を検出して詳細を返す
 */
function detectChanges(
  project: Project,
  beforeStates: Map<string, string>
): RenameResult["changedFiles"] {
  const changedFiles: RenameResult["changedFiles"] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    const beforeText = beforeStates.get(filePath);
    const afterText = sourceFile.getFullText();

    if (beforeText && beforeText !== afterText) {
      const changes = diffTexts(sourceFile, beforeText, afterText);
      if (changes.length > 0) {
        changedFiles.push({
          filePath,
          changes,
        });
      }
    }
  }

  return changedFiles;
}

/**
 * テキストの差分を検出（簡易版）
 */
function diffTexts(
  _sourceFile: SourceFile,
  beforeText: string,
  afterText: string
): Array<{ line: number; column: number; oldText: string; newText: string }> {
  const changes: Array<{
    line: number;
    column: number;
    oldText: string;
    newText: string;
  }> = [];

  const beforeLines = beforeText.split("\n");
  const afterLines = afterText.split("\n");

  for (let i = 0; i < Math.max(beforeLines.length, afterLines.length); i++) {
    const beforeLine = beforeLines[i] || "";
    const afterLine = afterLines[i] || "";

    if (beforeLine !== afterLine) {
      // 簡易的に行全体を変更として記録
      changes.push({
        line: i + 1,
        column: 1,
        oldText: beforeLine,
        newText: afterLine,
      });
    }
  }

  return changes;
}

/**
 * ノードがrename()メソッドを持っているかチェック
 */
function hasRenameMethod(node: Node): boolean {
  return (
    Node.isClassDeclaration(node) ||
    Node.isFunctionDeclaration(node) ||
    Node.isInterfaceDeclaration(node) ||
    Node.isTypeAliasDeclaration(node) ||
    Node.isEnumDeclaration(node) ||
    Node.isMethodDeclaration(node) ||
    Node.isPropertyDeclaration(node) ||
    Node.isGetAccessorDeclaration(node) ||
    Node.isSetAccessorDeclaration(node) ||
    Node.isParameterDeclaration(node) ||
    Node.isVariableDeclaration(node)
  );
}

/**
 * ノードがgetName()メソッドを持っているかチェック
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

/**
 * プロジェクトにソースファイルを追加
 */
export function addSourceFile(project: Project, filePath: string): SourceFile {
  return project.addSourceFileAtPath(filePath);
}

/**
 * プロジェクトに複数のソースファイルを追加
 */
export function addSourceFiles(project: Project, glob: string): SourceFile[] {
  return project.addSourceFilesAtPaths(glob);
}
