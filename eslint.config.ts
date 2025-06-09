import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import unusedImports from "eslint-plugin-unused-imports";

import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://example.com/rule/${name}`
);

export const noClass = createRule({
  name: "no-class",
  meta: {
    docs: {
      description: "Disallow the use of class declarations",
    },
    messages: {
      dontUseClass: "Do not use class",
    },
    type: "suggestion",
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      ClassExpression(node) {
        if (node.id != null) {
          context.report({
            messageId: "dontUseClass",
            node: node.id,
          });
        }
      },
      ClassDeclaration(node) {
        if (node.id != null) {
          context.report({
            messageId: "dontUseClass",
            node: node.id,
          });
        }
      },
    };
  },
});

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".claude/**",
      "examples/**",
      "tests/fixtures/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  // ...tseslint.configs.stylistic,
  // TODO: Fix for deno
  // importPlugin.flatConfigs!.recommended,
  {
    plugins: {
      "unused-imports": unusedImports,
      local: {
        rules: {
          "no-class": noClass,
        },
      },
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "local/no-class": "error",
    },
  },
  {
    // base rules
    rules: {
      "require-await": "error",
      "@typescript-eslint/no-redeclare": "error",
      "@typescript-eslint/prefer-ts-expect-error": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/only-throw-error": "error",
      "no-throw-literal": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // warning for refactoring
    rules: {
      "@typescript-eslint/no-empty-interface": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-empty-function": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-deprecated": "warn",
      "@typescript-eslint/await-thenable": "warn",
      "@typescript-eslint/require-await": "warn",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        {
          prefer: "type-imports",
          disallowTypeAnnotations: false,
          fixStyle: "inline-type-imports",
        },
      ],
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-ignore": true,
          "ts-expect-error": "allow-with-description",
        },
      ],
      "prefer-const": "warn",
      complexity: ["warn", { max: 7 }],
      "no-console": "warn",
    },
  },
  {
    // examples directory overrides
    files: ["examples/*.ts"],
    rules: {
      "no-console": "off",
    },
  }
);
