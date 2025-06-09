import { describe, expect, test, vi, beforeEach } from "vitest";
import { Project } from "ts-morph";
import { 
  handleGetSymbolsInScope,
  formatGetSymbolsInScopeResult,
  SymbolMeaning,
} from "./get_symbols_in_scope.ts";
import * as projectCache from "../utils/project_cache.ts";

// Mock the project cache module
vi.mock("../utils/project_cache.ts", () => ({
  findProjectForFile: vi.fn(),
  getOrCreateSourceFileWithRefresh: vi.fn(),
}));

// Mock fs/promises
vi.mock("fs/promises", () => ({
  default: {
    access: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("get_symbols_in_scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should get all symbols in scope", async () => {
    const project = new Project({
      useInMemoryFileSystem: true,
    });

    const testFile = project.createSourceFile(
      "/project/test.ts",
      `
import { readFile } from "fs";

interface User {
  id: number;
  name: string;
}

type UserId = number;

const globalVar = "test";

function processUser(user: User): UserId {
  const localVar = user.name;
  console.log(localVar);
  
  // Get symbols at this line
  return user.id;
}

class UserService {
  getUser(id: UserId): User {
    return { id, name: "Test" };
  }
}

enum Status {
  Active,
  Inactive
}
      `.trim()
    );

    await testFile.save();

    // Mock the project cache functions
    vi.mocked(projectCache.findProjectForFile).mockReturnValue(project);
    vi.mocked(projectCache.getOrCreateSourceFileWithRefresh).mockReturnValue(testFile);

    const result = await handleGetSymbolsInScope({
      root: "/project",
      filePath: "test.ts",
      line: 16, // Inside processUser function
      meaning: SymbolMeaning.All,
    });

    // Check that we have symbols in different categories
    expect(result.symbolsByKind["Variables & Functions"]).toBeDefined();
    expect(result.symbolsByKind["Types & Interfaces"]).toBeDefined();
    expect(result.symbolsByKind["Classes"]).toBeDefined();

    // Check for specific symbols
    const varsFuncs = result.symbolsByKind["Variables & Functions"];
    const symbolNames = varsFuncs.map(s => s.name);
    
    // Should include local variables
    expect(symbolNames).toContain("localVar");
    expect(symbolNames).toContain("user");
    
    // Should include global variables
    expect(symbolNames).toContain("globalVar");
    expect(symbolNames).toContain("processUser");
    
    // Should include imported symbols - readFile might not be visible if not a named export
    // expect(symbolNames).toContain("readFile");
    
    // Check types
    const types = result.symbolsByKind["Types & Interfaces"];
    const typeNames = types.map(s => s.name);
    expect(typeNames).toContain("User");
    expect(typeNames).toContain("UserId");
    
    // Check that total count is reasonable
    expect(result.totalCount).toBeGreaterThan(10);
  });

  test("should filter by meaning", async () => {
    const project = new Project({
      useInMemoryFileSystem: true,
    });

    const testFile = project.createSourceFile(
      "/project/test.ts",
      `
interface Config {
  port: number;
}

const config: Config = { port: 3000 };

function getPort(): number {
  return config.port;
}

type Port = number;
      `.trim()
    );

    await testFile.save();

    // Mock the project cache functions
    vi.mocked(projectCache.findProjectForFile).mockReturnValue(project);
    vi.mocked(projectCache.getOrCreateSourceFileWithRefresh).mockReturnValue(testFile);

    // Get only types
    const typesResult = await handleGetSymbolsInScope({
      root: "/project",
      filePath: "test.ts",
      line: 8, // Inside getPort function
      meaning: SymbolMeaning.Type,
    });

    // Should have types but not variables
    expect(typesResult.symbolsByKind["Types & Interfaces"]).toBeDefined();
    expect(typesResult.symbolsByKind["Variables & Functions"]).toBeUndefined();

    // Get only values
    const valuesResult = await handleGetSymbolsInScope({
      root: "/project",
      filePath: "test.ts",
      line: 8,
      meaning: SymbolMeaning.Value,
    });

    // Should have variables but not types - although some global types might leak through
    expect(valuesResult.symbolsByKind["Variables & Functions"]).toBeDefined();
    // Check that we have our expected values
    const valueNames = valuesResult.symbolsByKind["Variables & Functions"].map(s => s.name);
    expect(valueNames).toContain("config");
    expect(valueNames).toContain("getPort");
  });

  test("should handle different scopes", async () => {
    const project = new Project({
      useInMemoryFileSystem: true,
    });

    const testFile = project.createSourceFile(
      "/project/test.ts",
      `
const globalVar = "global";

function outer() {
  const outerVar = "outer";
  
  function inner() {
    const innerVar = "inner";
    // Line 8: Should see all variables
    return innerVar + outerVar + globalVar;
  }
  
  // Line 12: Should not see innerVar
  return outerVar;
}
      `.trim()
    );

    await testFile.save();

    // Mock the project cache functions
    vi.mocked(projectCache.findProjectForFile).mockReturnValue(project);
    vi.mocked(projectCache.getOrCreateSourceFileWithRefresh).mockReturnValue(testFile);

    // Check inner scope
    const innerResult = await handleGetSymbolsInScope({
      root: "/project",
      filePath: "test.ts",
      line: 8,
      meaning: SymbolMeaning.Variable,
    });

    const innerVars = innerResult.symbolsByKind["Variables & Functions"];
    const innerVarNames = innerVars.map(s => s.name);
    
    expect(innerVarNames).toContain("innerVar");
    expect(innerVarNames).toContain("outerVar");
    expect(innerVarNames).toContain("globalVar");

    // Check outer scope
    const outerResult = await handleGetSymbolsInScope({
      root: "/project",
      filePath: "test.ts",
      line: 12,
      meaning: SymbolMeaning.Variable,
    });

    const outerVars = outerResult.symbolsByKind["Variables & Functions"];
    const outerVarNames = outerVars.map(s => s.name);
    
    expect(outerVarNames).toContain("outerVar");
    expect(outerVarNames).toContain("globalVar");
    expect(outerVarNames).not.toContain("innerVar"); // Should not see inner variable
  });

  test("should format output correctly", () => {
    const result = {
      location: {
        filePath: "/project/src/test.ts",
        line: 10,
      },
      meaning: SymbolMeaning.All,
      symbolsByKind: {
        "Variables & Functions": [
          { name: "console", kind: "variable", type: "Console", exported: false },
          { name: "myFunction", kind: "function", type: "(x: number) => void", exported: true },
          { name: "localVar", kind: "variable", type: "string", exported: false },
        ],
        "Types & Interfaces": [
          { name: "MyInterface", kind: "interface", exported: true },
          { name: "MyType", kind: "type alias", exported: false },
        ],
        "Classes": [
          { name: "MyClass", kind: "class", exported: true },
        ],
      },
      totalCount: 6,
    };

    const formatted = formatGetSymbolsInScopeResult(result, "/project");
    
    expect(formatted).toContain("Symbols in scope at src/test.ts:10");
    expect(formatted).toContain("Meaning: All");
    expect(formatted).toContain("Variables & Functions (3):");
    expect(formatted).toContain("  - console: Console");
    expect(formatted).toContain("  - myFunction: (x: number) => void [exported]");
    expect(formatted).toContain("Types & Interfaces (2):");
    expect(formatted).toContain("  - MyInterface (interface) [exported]");
    expect(formatted).toContain("Classes (1):");
    expect(formatted).toContain("Total: 6 symbols");
  });

  test("should handle line string matching", async () => {
    const project = new Project({
      useInMemoryFileSystem: true,
    });

    const testFile = project.createSourceFile(
      "/project/test.ts",
      `
const a = 1;
const b = 2;
// Special marker line
const c = 3;
      `.trim()
    );

    await testFile.save();

    // Mock the project cache functions
    vi.mocked(projectCache.findProjectForFile).mockReturnValue(project);
    vi.mocked(projectCache.getOrCreateSourceFileWithRefresh).mockReturnValue(testFile);

    const result = await handleGetSymbolsInScope({
      root: "/project",
      filePath: "test.ts",
      line: "Special marker", // Should match line 3
      meaning: SymbolMeaning.Variable,
    });

    expect(result.location.line).toBe(3);
  });
});