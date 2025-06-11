import { LSPClient } from "./lsp_client.ts";
import { findReferencesWithLSP } from "./lsp_find_references.ts";
import { getDefinitionsWithLSP } from "./lsp_get_definitions.ts";
import { getHoverWithLSP } from "./lsp_get_hover.ts";

async function testErrorHandling() {
  console.log("=== Testing LSP Error Handling ===\n");
  
  const projectRoot = process.cwd();
  
  // Test 1: Non-existent file
  console.log("1. Testing with non-existent file:");
  const nonExistentResult = await findReferencesWithLSP(projectRoot, {
    filePath: "../../examples/does-not-exist.ts",
    line: 1,
    column: 1,
  });
  
  if (nonExistentResult.isErr()) {
    console.log("   ✓ Correctly handled non-existent file");
    console.log(`   Error: ${nonExistentResult.error}`);
  } else {
    console.log("   ❌ Should have failed for non-existent file");
  }
  
  // Test 2: Invalid position (out of bounds)
  console.log("\n2. Testing with invalid position:");
  const invalidPosResult = await findReferencesWithLSP(projectRoot, {
    filePath: "../../examples/types.ts",
    line: 1000,  // Way out of bounds
    column: 1000,
  });
  
  if (invalidPosResult.isOk()) {
    console.log("   ✓ LSP handled out-of-bounds position gracefully");
    console.log(`   Found ${invalidPosResult.value.references.length} references`);
  } else {
    console.log("   ✓ Error returned for out-of-bounds position");
    console.log(`   Error: ${invalidPosResult.error}`);
  }
  
  // Test 3: Empty position (no symbol)
  console.log("\n3. Testing with empty position (no symbol):");
  const emptyPosResult = await getHoverWithLSP(projectRoot, {
    filePath: "../../examples/types.ts",
    line: 3,  // Empty line
    column: 1,
  });
  
  if (emptyPosResult.isOk()) {
    console.log("   ✓ LSP handled empty position");
    console.log(`   Message: ${emptyPosResult.value.message}`);
  } else {
    console.log("   Error: ${emptyPosResult.error}");
  }
  
  // Test 4: Invalid file content syntax
  console.log("\n4. Testing with invalid TypeScript syntax:");
  const client = new LSPClient(projectRoot);
  
  try {
    await client.start();
    
    // Create a temporary file with syntax errors
    const invalidContent = `
export type Broken = {
  value: string
  // Missing closing brace
    `;
    
    const tempFileUri = `file://${projectRoot}/temp-broken.ts`;
    await client.openDocument(tempFileUri, invalidContent);
    
    // Try to get hover on the broken type
    const hover = await client.getHover(tempFileUri, {
      line: 1,
      character: 12,
    });
    
    console.log("   ✓ LSP handled syntax error gracefully");
    console.log(`   Hover result: ${hover ? "Available" : "No hover info"}`);
    
    await client.stop();
  } catch (error) {
    console.log("   ✓ Error caught:", error);
  }
  
  // Test 5: Server crash recovery
  console.log("\n5. Testing server crash recovery:");
  const crashClient = new LSPClient(projectRoot);
  
  try {
    await crashClient.start();
    
    // Force kill the process to simulate crash
    if ((crashClient as any).process) {
      (crashClient as any).process.kill('SIGKILL');
    }
    
    // Try to use the client after crash
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      await crashClient.getHover(`file://${projectRoot}/../../examples/types.ts`, {
        line: 0,
        character: 0,
      });
      console.log("   ❌ Should have thrown error after crash");
    } catch (error) {
      console.log("   ✓ Correctly detected server crash");
      console.log(`   Error: ${error}`);
    }
  } catch (error) {
    console.log("   Error during crash test:", error);
  }
  
  console.log("\n✅ Error handling tests completed");
}

// Run the test
testErrorHandling().catch(console.error);