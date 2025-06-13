# ESLint to Oxlint + TypeScript 移行まとめ

## 実施内容

### 1. Oxlintの導入
- `pnpm lint`: Oxlint使用（約16倍高速化: 4.9秒 → 0.3秒）
- `pnpm lint:eslint`: ESLint使用（フォールバック）
- `oxlintrc.json`: 主要なルールを移行

### 2. TypeScriptコンパイラへの移行
tsconfig.jsonに以下を追加：
```json
{
  "compilerOptions": {
    "noImplicitAny": true,      // any型の暗黙的使用を禁止
    "noUnusedLocals": true,     // 未使用のローカル変数を検出
    "noUnusedParameters": true  // 未使用のパラメータを検出
  }
}
```

### 3. 検出能力の比較

| チェック項目 | ESLint | Oxlint | TypeScript |
|------------|--------|---------|------------|
| any型の使用 | ✅ | ❌ | ✅ |
| 未使用変数 | ✅ | ✅ | ✅ |
| コード複雑度 | ✅ | ❌ | ❌ |
| import type | ✅ | ❌ | ❌ |
| console使用 | ✅ | ❌ | ❌ |
| カスタムルール | ✅ | ❌ | ❌ |

### 4. 推奨される使い分け

- **開発時**: `pnpm lint` (Oxlint) - 高速なフィードバック
- **型チェック**: `pnpm typecheck` - any型と未使用変数の検出
- **完全チェック**: `pnpm lint:eslint` - CI/プレコミット用

### 5. パフォーマンス比較

- Oxlint: ~0.3秒
- TypeScript: ~2秒（typecheck）
- ESLint: ~4.9秒

TypeScriptの型チェックにany型と未使用変数の検出を移行することで、Oxlintの高速性を活かしつつ、重要な型安全性チェックを維持できます。