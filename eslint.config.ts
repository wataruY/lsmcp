import { ESLintUtils } from "@typescript-eslint/utils";
import tseslint from "typescript-eslint";

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

// Use flat config directly
export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".claude/**",
      "examples/**",
      "tests/fixtures/**",
      "playground/**",
      "tmp/**",
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      local: {
        rules: {
          "no-class": noClass,
        },
      },
    },
    rules: {
      "local/no-class": "error",
    },
  }
];