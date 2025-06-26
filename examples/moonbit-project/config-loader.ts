import { MoonbitProjectManager, MoonbitConfig } from "./src/utils/project";

// Test code completion and other features
const project = new MoonbitProjectManager("./moon.mod.json");

// Try to access methods
const name = project.getProject();
const version = project.getProject();

// Create a new config
const config: MoonbitConfig = {
  
};

// Test build function
import { build } from "./src/utils/project";

build("./");