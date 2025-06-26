import { MoonbitProjectManager, BuildTarget } from "./src/utils/project";

async function runTests() {
  const project = new MoonbitProjectManager("./moon.mod.json");
  
  console.log(`Running tests for ${project.getName()} v${project.getVersion()}`);
  
  const targets: BuildTarget[] = ["wasm", "js"];
  
  for (const target of targets) {
    
  }
}

// Execute tests
runTests().catch(console.error);