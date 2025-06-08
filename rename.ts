import { Project, SyntaxKind } from "ts-morph";

// プロジェクトを作成
const project = new Project({
  tsConfigFilePath: "./tsconfig.json",
});

// ソースファイルを取得
const sourceFile = project.getSourceFileOrThrow("./src/main.ts");

// 基本的な変数リネーム
function renameVariable(oldName: string, newName: string) {
  const variableDeclaration = sourceFile.getVariableDeclaration(oldName);
  
  if (variableDeclaration) {
    // rename()メソッドですべての参照が自動的に更新される
    variableDeclaration.rename(newName);
    sourceFile.save();
    console.log(`✅ ${oldName} → ${newName} にリネームしました`);
  } else {
    console.log(`❌ 変数 ${oldName} が見つかりませんでした`);
  }
}

// 関数をリネーム
function renameFunction(oldName: string, newName: string) {
  const functionDeclaration = sourceFile.getFunction(oldName);
  
  if (functionDeclaration) {
    functionDeclaration.rename(newName);
    sourceFile.save();
    console.log(`✅ 関数 ${oldName} → ${newName} にリネームしました`);
  }
}

// クラスのメソッドやプロパティをリネーム
function renameClassMember(className: string, oldMemberName: string, newMemberName: string) {
  const classDeclaration = sourceFile.getClass(className);
  
  if (classDeclaration) {
    // メソッドを探す
    const method = classDeclaration.getMethod(oldMemberName);
    if (method) {
      method.rename(newMemberName);
      sourceFile.save();
      console.log(`✅ メソッド ${oldMemberName} → ${newMemberName} にリネームしました`);
      return;
    }
    
    // プロパティを探す
    const property = classDeclaration.getProperty(oldMemberName);
    if (property) {
      property.rename(newMemberName);
      sourceFile.save();
      console.log(`✅ プロパティ ${oldMemberName} → ${newMemberName} にリネームしました`);
    }
  }
}

// プロジェクト全体で識別子をリネーム
function renameAcrossProject(oldName: string, newName: string) {
  const sourceFiles = project.getSourceFiles();
  
  sourceFiles.forEach(file => {
    // すべての識別子を検索
    const identifiers = file.getDescendantsOfKind(SyntaxKind.Identifier);
    
    for (const identifier of identifiers) {
      if (identifier.getText() === oldName) {
        const symbol = identifier.getSymbol();
        if (symbol) {
          const declarations = symbol.getDeclarations();
          if (declarations.length > 0) {
            // 最初の宣言からリネーム（すべての参照が更新される）
            declarations[0].rename(newName);
            break;
          }
        }
      }
    }
  });
  
  // すべてのファイルを保存
  project.saveSync();
  console.log(`✅ プロジェクト全体で ${oldName} → ${newName} にリネームしました`);
}

// 使用例
// renameVariable("count", "totalCount");
// renameFunction("calculateSum", "computeTotal");
// renameClassMember("Calculator", "add", "addNumbers");
// renameAcrossProject("oldGlobalVar", "newGlobalVar");
