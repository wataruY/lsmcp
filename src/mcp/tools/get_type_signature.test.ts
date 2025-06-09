import { describe, it, expect } from "vitest";
import { formatGetTypeSignatureResult } from "./get_type_signature.ts";
import type { GetTypeSignatureResult } from "./get_type_signature.ts";
import type { TypeSignature } from "../../navigations/get_type_signature.ts";

describe("get_type_signature", () => {
  describe("formatGetTypeSignatureResult", () => {
    it("should format function signature", () => {
      const signature: TypeSignature = {
        kind: "function",
        functionSignatures: [
          {
            parameters: [
              { name: "a", type: "number", optional: false },
              { name: "b", type: "number", optional: false },
            ],
            returnType: "number",
          },
        ],
      };

      const result: GetTypeSignatureResult = {
        message: "Found type 'add' in module 'math-utils'",
        signature,
        root: "/project",
      };

      expect(formatGetTypeSignatureResult(result)).toMatchInlineSnapshot(`
        "Found type 'add' in module 'math-utils'

        📝 Function Signatures:
          (a: number, b: number): number"
      `);
    });

    it("should format function with multiple overloads", () => {
      const signature: TypeSignature = {
        kind: "function",
        functionSignatures: [
          {
            parameters: [{ name: "value", type: "string", optional: false }],
            returnType: "string",
          },
          {
            parameters: [{ name: "value", type: "number", optional: false }],
            returnType: "number",
          },
        ],
      };

      const result: GetTypeSignatureResult = {
        message: "Found type 'identity' in module 'utils'",
        signature,
        root: "/project",
      };

      expect(formatGetTypeSignatureResult(result)).toMatchInlineSnapshot(`
        "Found type 'identity' in module 'utils'

        📝 Function Signatures:

        Overload 1:
          (value: string): string

        Overload 2:
          (value: number): number"
      `);
    });

    it("should format type alias", () => {
      const signature: TypeSignature = {
        kind: "type",
        typeDefinition: "string | number | boolean",
      };

      const result: GetTypeSignatureResult = {
        message: "Found type 'Primitive' in module 'types'",
        signature,
        root: "/project",
      };

      expect(formatGetTypeSignatureResult(result)).toMatchInlineSnapshot(`
        "Found type 'Primitive' in module 'types'

        📋 Type Definition:
          Type: string | number | boolean"
      `);
    });

    it("should format interface", () => {
      const signature: TypeSignature = {
        kind: "interface",
        properties: [
          { name: "id", type: "number", optional: false, readonly: false },
          { name: "name", type: "string", optional: false, readonly: false },
          { name: "email", type: "string", optional: true, readonly: false },
        ],
      };

      const result: GetTypeSignatureResult = {
        message: "Found type 'User' in module 'models'",
        signature,
        root: "/project",
      };

      expect(formatGetTypeSignatureResult(result)).toMatchInlineSnapshot(`
        "Found type 'User' in module 'models'

        📐 Interface Definition:

          Properties:
            id: number
            name: string
            email?: string"
      `);
    });

    it("should format class with methods", () => {
      const signature: TypeSignature = {
        kind: "class",
        properties: [
          { name: "name", type: "string", optional: false, readonly: false },
        ],
        methods: [
          {
            name: "greet",
            signatures: [
              {
                parameters: [],
                returnType: "void",
              },
            ],
          },
          {
            name: "setName",
            signatures: [
              {
                parameters: [{ name: "name", type: "string", optional: false }],
                returnType: "void",
              },
            ],
          },
        ],
      };

      const result: GetTypeSignatureResult = {
        message: "Found type 'Person' in module 'entities'",
        signature,
        root: "/project",
      };

      expect(formatGetTypeSignatureResult(result)).toMatchInlineSnapshot(`
        "Found type 'Person' in module 'entities'

        🏗️ Class Definition:

          Properties:
            name: string

          Methods:
            greet(): void
            setName(name: string): void"
      `);
    });

    it("should format with documentation", () => {
      const signature: TypeSignature = {
        kind: "function",
        functionSignatures: [
          {
            parameters: [
              { name: "str", type: "string", optional: false },
            ],
            returnType: "string",
          },
        ],
      };

      const result: GetTypeSignatureResult = {
        message: "Found type 'capitalize' in module 'string-utils'",
        signature,
        documentation: "Capitalizes the first letter of a string",
        root: "/project",
      };

      expect(formatGetTypeSignatureResult(result)).toMatchInlineSnapshot(`
        "Found type 'capitalize' in module 'string-utils'

        📖 Documentation:
        Capitalizes the first letter of a string

        📝 Function Signatures:
          (str: string): string"
      `);
    });
  });
});