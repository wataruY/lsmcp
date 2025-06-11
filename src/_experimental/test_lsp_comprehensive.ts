import { LSPClient } from "./lsp_client.ts";
import { readFileSync } from "fs";
import { resolve } from "path";

async function testLSPDirectly() {
  const projectRoot = process.cwd();
  const client = new LSPClient(projectRoot);
  
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
    await client.openDocument(fileUri, fileContent);
    console.log("   ✓ Document opened");
    
    // Wait for LSP to process
    console.log("\n3. Waiting for LSP to process document...");
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log("   ✓ Ready");
    
    // Test 1: Find references for "Value" type
    console.log("\n4. Testing find references for 'Value' type:");
    console.log("   Position: line 1, column 13");
    const references = await client.findReferences(fileUri, {
      line: 0,  // 0-based
      character: 12,  // 0-based
    });
    console.log(`   ✓ Found ${references.length} references`);
    references.forEach((ref, i) => {
      const filePath = ref.uri.replace("file://", "");
      console.log(`   [${i + 1}] ${filePath}:${ref.range.start.line + 1}:${ref.range.start.character + 1}`);
    });
    
    // Test 2: Get definition
    console.log("\n5. Testing get definition for 'v' property in return statement:");
    console.log("   Position: line 11, column 12");
    const definitions = await client.getDefinition(fileUri, {
      line: 10,  // 0-based
      character: 11,  // 0-based
    });
    const defArray = Array.isArray(definitions) ? definitions : [definitions];
    console.log(`   ✓ Found ${defArray.length} definitions`);
    defArray.forEach((def, i) => {
      if (def) {
        const filePath = def.uri.replace("file://", "");
        console.log(`   [${i + 1}] ${filePath}:${def.range.start.line + 1}:${def.range.start.character + 1}`);
      }
    });
    
    // Test 3: Get hover
    console.log("\n6. Testing get hover for 'ValueWithOptional' type:");
    console.log("   Position: line 5, column 13");
    const hover = await client.getHover(fileUri, {
      line: 4,  // 0-based
      character: 12,  // 0-based
    });
    console.log(`   ✓ Got hover info`);
    if (hover) {
      console.log("   Hover contents:");
      if (typeof hover.contents === "string") {
        console.log(`   ${hover.contents}`);
      } else if (Array.isArray(hover.contents)) {
        hover.contents.forEach((content: any) => {
          console.log(`   ${typeof content === "string" ? content : content.value}`);
        });
      } else if (hover.contents && typeof hover.contents === "object" && "value" in hover.contents) {
        console.log(`   ${hover.contents.value}`);
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