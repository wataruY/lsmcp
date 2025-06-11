import { findReferencesWithLSP } from "./lsp_find_references.ts";
import { getDefinitionsWithLSP } from "./lsp_get_definitions.ts";
import { getHoverWithLSP } from "./lsp_get_hover.ts";

async function testLSPFeatures() {
  // Test with a simple example file
  const projectRoot = process.cwd();
  
  console.log("Testing LSP features with tsgo...\n");
  
  // Test find references - targeting "Value" type
  console.log("1. Testing find references for 'Value' type:");
  const referencesResult = await findReferencesWithLSP(projectRoot, {
    filePath: "../../examples/types.ts",
    line: 1,  // Line with "Value" type declaration
    column: 13,  // Position of "Value"
  });
  
  if (referencesResult.isOk()) {
    console.log(referencesResult.value.message);
    console.log("References found:");
    referencesResult.value.references.forEach((ref) => {
      console.log(`  - ${ref.filePath}:${ref.line}:${ref.column} - ${ref.lineText}`);
    });
  } else {
    console.error("Error finding references:", referencesResult.error);
  }
  
  console.log("\n2. Testing get definitions for 'getValue' function:");
  const definitionsResult = await getDefinitionsWithLSP(projectRoot, {
    filePath: "../../examples/types.ts",
    line: 11,  // Line with getValue return statement
    column: 12,  // Position of "v" property
  });
  
  if (definitionsResult.isOk()) {
    console.log(definitionsResult.value.message);
    console.log("Definitions found:");
    definitionsResult.value.definitions.forEach((def) => {
      console.log(`  - ${def.filePath}:${def.line}:${def.column} - ${def.lineText}`);
    });
  } else {
    console.error("Error getting definitions:", definitionsResult.error);
  }
  
  console.log("\n3. Testing get hover for 'ValueWithOptional' type:");
  const hoverResult = await getHoverWithLSP(projectRoot, {
    filePath: "../../examples/types.ts",
    line: 5,  // Line with ValueWithOptional type
    column: 13,  // Position of "ValueWithOptional"
  });
  
  if (hoverResult.isOk()) {
    console.log(hoverResult.value.message);
    if (hoverResult.value.hover) {
      console.log("Hover content:");
      console.log(hoverResult.value.hover.contents);
    }
  } else {
    console.error("Error getting hover:", hoverResult.error);
  }
}

// Run the test
testLSPFeatures().catch(console.error);