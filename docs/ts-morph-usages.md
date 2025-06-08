# ts-morph 基本的な使い方

ts-morphは、TypeScript ASTの設定、ナビゲーション、操作を簡単に行うためのライブラリです。

## インストール

```bash
npm install --save-dev ts-morph
```

## 基本セットアップ

### プロジェクトの初期化

```typescript
import { Project } from "ts-morph";

// 基本的なプロジェクトの作成
const project = new Project();

// コンパイラオプションを指定
const project = new Project({
  compilerOptions: {
    target: ScriptTarget.ES2020,
  },
});

// tsconfig.jsonを使用
const project = new Project({
  tsConfigFilePath: "path/to/tsconfig.json",
});
```

### ソースファイルの追加

```typescript
// ファイルパスでソースファイルを追加
const sourceFile = project.addSourceFileAtPath("path/to/file.ts");

// グロブパターンで複数ファイルを追加
project.addSourceFilesAtPaths("src/**/*.ts");

// テキストからソースファイルを作成
const sourceFile = project.createSourceFile("path/to/new.ts", "const a = 5;");
```

## AST ナビゲーション

### 基本的なナビゲーション

```typescript
// 子ノードの取得
const children = node.getChildren();

// 特定の種類の子ノードを取得
const identifiers = node.getChildrenOfKind(SyntaxKind.Identifier);

// 子ノードを反復処理
node.forEachChild(child => {
  console.log(child.getText());
});

// 全ての子孫ノードを反復処理
node.forEachDescendant(descendant => {
  console.log(descendant.getText());
});
```

### トラバーサル制御

```typescript
node.forEachDescendant((node, traversal) => {
  switch (node.getKind()) {
    case SyntaxKind.ClassDeclaration:
      traversal.skip(); // 現在のノードの子孫をスキップ
      break;
    case SyntaxKind.FunctionDeclaration:
      traversal.stop(); // トラバーサルを完全に停止
      break;
  }
});
```

## 主要な機能

### 1. リネーム (Rename)

```typescript
// 識別子をリネーム
const identifier = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)[0];
identifier.rename("newName");

// 宣言をリネーム（全ての使用箇所を更新）
const myEnum = sourceFile.getEnum("MyEnum")!;
myEnum.rename("NewEnum");

// コメントや文字列内もリネーム
myEnum.rename("NewEnum", {
  renameInComments: true,
  renameInStrings: true,
});

// プレフィックス・サフィックステキストを使用
varA.rename("b", {
  usePrefixAndSuffixText: true,
});
```

### 2. 参照の検索 (Find References)

```typescript
// 全ての参照を検索
const classDeclaration = sourceFile.getClass("MyClass")!;
const referencedSymbols = classDeclaration.findReferences();

for (const referencedSymbol of referencedSymbols) {
  for (const reference of referencedSymbol.getReferences()) {
    console.log("File path: " + reference.getSourceFile().getFilePath());
    console.log("Start: " + reference.getTextSpan().getStart());
    console.log("Length: " + reference.getTextSpan().getLength());
  }
}

// 参照しているノードだけを取得
const nodes = classDeclaration.findReferencesAsNodes();
```

### 3. 定義へ移動 (Go to Definition)

```typescript
// 識別子の定義を取得
const identifier = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)[0];
const definitions = identifier.getDefinitions();

// 定義ノードを直接取得
const definitionNodes = identifier.getDefinitionNodes();

// 実装を取得
const implementations = identifier.getImplementations();
```

## ファイル操作

### ソースファイルの保存・削除・移動

```typescript
// 保存
await sourceFile.save();

// 削除（キューに追加）
sourceFile.delete();
await project.save(); // 実際にファイルシステムに反映

// 即座に削除
await sourceFile.deleteImmediately();

// コピー
const newSourceFile = sourceFile.copy("newFile.ts");
sourceFile.copyToDirectory("/some/dir");

// 移動（インポートパスも自動更新）
sourceFile.move("newPath.ts");
sourceFile.moveToDirectory("/new/dir");
```

### コード修正機能

```typescript
// インポートの整理
sourceFile.organizeImports();

// 不足しているインポートを追加
sourceFile.fixMissingImports();

// 未使用の識別子を削除
sourceFile.fixUnusedIdentifiers();
```

## AST操作

### ノードの置換

```typescript
// ノードをテキストで置換
const node = sourceFile.getVariableDeclarations()[0].getInitializerOrThrow();
const newNode = node.replaceWithText("MyNewReference");
```

### ステートメントの追加・挿入・削除

```typescript
// ステートメントを追加
sourceFile.addStatements("console.log(5);");

// 特定の位置に挿入
sourceFile.insertStatements(3, "console.log('inserted');");

// 削除
sourceFile.removeStatement(1);
sourceFile.removeStatements([1, 3]); // インデックス1から3まで削除
```

### テキストの直接操作

```typescript
// テキストを挿入
sourceFile.insertText(0, "// new comment\n");

// テキストを置換
sourceFile.replaceText([3, 7], "replaced");

// テキストを削除
sourceFile.removeText(0, 10);
```

注意: これらのメソッドを使用すると、以前にナビゲートした子孫ノードは忘れられ、再度ナビゲートする必要があります。

## ベストプラクティス

1. **プロジェクトの保存**: 個別のファイル操作ではなく、最後に`project.save()`を呼び出すことで、エラー時にファイルシステムが中途半端な状態になることを防げます。

2. **ノードの再取得**: `insertText`、`replaceText`、`removeText`を使用した後は、ノードを再取得する必要があります。

3. **コード修正の順序**: `organizeImports()`や`fixUnusedIdentifiers()`は、他の操作の前か後に実行することを推奨します。

4. **参照の更新**: ファイルの移動やリネーム時は、ts-morphが自動的に相対インポートを更新します。

## MCP サーバー実装時の考慮事項

MCPサーバーでts-morphを使用する場合、以下の点に注意：

1. **プロジェクトの初期化**: リクエストごとにプロジェクトを再作成するか、キャッシュを適切に管理する
2. **ファイルシステムとの同期**: 変更を即座に反映するか、バッチで処理するかを検討
3. **エラーハンドリング**: ファイルが見つからない、構文エラーがある場合の処理
4. **パフォーマンス**: 大規模プロジェクトでの参照検索は時間がかかる可能性がある