import { createLSPClient } from "./lsp_client.ts";
import { type Hover } from "vscode-languageserver-types";
import { readFileSync } from "fs";
import { resolve } from "path";

async function testLSPDirectly() {
  const projectRoot = process.cwd();
  const client = createLSPClient(projectRoot);

  console.log("=== Testing LSP Server Directly ===\n");

  try {
    // Start LSP server
    console.log("1. Starting LSP server...");
    await client.start();
    console.log("   ✓ LSP server started successfully");

    // Test file path
    const testFilePath = resolve(projectRoot, "../../examples/types.ts");
    const fileContent = readFileSync(testFilePath, "utf-8");
    const fileUri = `file://${testFilePath}`;

    console.log("\n2. Opening document...");
    console.log(`   File: ${testFilePath}`);
    client.openDocument(fileUri, fileContent);
    console.log("   ✓ Document opened");

    // Wait for LSP to process
    console.log("\n3. Waiting for LSP to process document...");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log("   ✓ Ready");

    // Test 1: Find references for "Value" type
    console.log("\n4. Testing find references for 'Value' type:");
    console.log("   Position: line 1, column 13");
    const references = await client.findReferences(fileUri, {
      line: 0, // 0-based
      character: 12, // 0-based
    });
    console.log(`   ✓ Found ${references.length} references`);
    references.forEach((ref, i) => {
      const filePath = ref.uri.replace("file://", "");
      console.log(
        `   [${i + 1}] ${filePath}:${ref.range.start.line + 1}:${
          ref.range.start.character + 1
        }`
      );
    });

    // Test 2: Get definition
    console.log(
      "\n5. Testing get definition for 'v' property in return statement:"
    );
    console.log("   Position: line 11, column 12");
    const definitions = await client.getDefinition(fileUri, {
      line: 10, // 0-based
      character: 11, // 0-based
    });
    const defArray = Array.isArray(definitions) ? definitions : [definitions];
    console.log(`   ✓ Found ${defArray.length} definitions`);
    defArray.forEach((def, i) => {
      if (Array.isArray(def) && def.length > 0) {
        const filePath = def.uri.replace("file://", "");
        console.log(
          `   [${i + 1}] ${filePath}:${def.range.start.line + 1}:${
            def.range.start.character + 1
          }`
        );
      }
    });

    // Test 3: Get hover
    console.log("\n6. Testing get hover for 'ValueWithOptional' type:");
    console.log("   Position: line 5, column 13");
    const hover = await client.getHover(fileUri, {
      line: 4, // 0-based
      character: 12, // 0-based
    });
    console.log(`   ✓ Got hover info`);
    if (hover) {
      const hoverResult = hover as Hover;
      console.log("   Hover contents:");
      if (typeof hoverResult.contents === "string") {
        console.log(`   ${hoverResult.contents}`);
      } else if (Array.isArray(hoverResult.contents)) {
        hoverResult.contents.forEach((content) => {
          console.log(
            `   ${
              typeof content === "string"
                ? content
                : "value" in content
                ? // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
                  (content as any).value
                : ""
            }`
          );
        });
      } else if ("value" in hoverResult.contents) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        console.log(`   ${(hoverResult.contents as any).value}`);
      }
    }

    // Clean up
    console.log("\n7. Shutting down LSP server...");
    await client.stop();
    console.log("   ✓ LSP server stopped");
  } catch (error) {
    console.error("\n❌ Error:", error);
    await client.stop().catch(() => {});
  }
}

// Run the test
testLSPDirectly().catch(console.error);
