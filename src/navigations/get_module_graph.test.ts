import { describe, it, expect } from "vitest";
import { Project } from "ts-morph";
import { getModuleGraph } from "./get_module_graph.ts";

describe("getModuleGraph", () => {
  it("should analyze a simple module graph", () => {
    const project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        target: 99,
        module: 99,
      },
    });

    // Create test files
    project.createSourceFile(
      "/project/src/index.ts",
      `
import { helper } from "./utils/helper.ts";
import { config } from "./config.ts";

export function main() {
  return helper() + config.value;
}
      `
    );

    project.createSourceFile(
      "/project/src/utils/helper.ts",
      `
export function helper() {
  return "helper";
}
      `
    );

    project.createSourceFile(
      "/project/src/config.ts",
      `
export const config = {
  value: 42
};
      `
    );

    const result = getModuleGraph(project, {
      rootDir: "/project",
      entryPoints: ["/project/src/a.ts"],  // Start from one file in the cycle
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;

    const { graph } = result.value;
    
    expect(graph.stats.totalFiles).toBe(3);
    expect(graph.stats.totalImports).toBe(2);
    expect(graph.stats.totalExports).toBe(3); // main, helper, config
    expect(graph.stats.circularDependencies).toHaveLength(0);

    // Check specific file relationships
    const indexFile = graph.files.find(f => f.path === "src/index.ts");
    expect(indexFile).toBeDefined();
    expect(indexFile?.imports).toHaveLength(2);
    expect(indexFile?.importedBy).toHaveLength(0); // It's an entry point

    const helperFile = graph.files.find(f => f.path === "src/utils/helper.ts");
    expect(helperFile).toBeDefined();
    expect(helperFile?.importedBy).toContain("src/index.ts");
  });

  it("should detect circular dependencies", () => {
    const project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        target: 99,
        module: 99,
      },
    });

    // Create circular dependency: a -> b -> c -> a
    project.createSourceFile(
      "/project/src/a.ts",
      `
import { b } from "./b.ts";
export const a = "a" + b;
      `
    );

    project.createSourceFile(
      "/project/src/b.ts",
      `
import { c } from "./c.ts";
export const b = "b" + c;
      `
    );

    project.createSourceFile(
      "/project/src/c.ts",
      `
import { a } from "./a.ts";
export const c = "c" + a;
      `
    );

    const result = getModuleGraph(project, {
      rootDir: "/project",
      entryPoints: ["/project/src/a.ts"],
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;

    const { graph } = result.value;
    
    expect(graph.stats.circularDependencies).toHaveLength(1);
    const cycle = graph.stats.circularDependencies[0];
    expect(cycle).toHaveLength(4); // a -> b -> c -> a
    expect(cycle[0]).toBe(cycle[3]); // Cycle completes
  });

  it("should only include files reachable from entry points", () => {
    const project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        target: 99,
        module: 99,
      },
    });

    project.createSourceFile("/project/src/entry.ts", `
import { helper } from "./helper.ts";
export const entry = helper();
    `);
    project.createSourceFile("/project/src/helper.ts", `export const helper = () => "helper";`);
    project.createSourceFile("/project/src/unreachable.ts", `export const unreachable = "not imported";`);

    const result = getModuleGraph(project, {
      rootDir: "/project",
      entryPoints: ["/project/src/entry.ts"],
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;

    const { graph } = result.value;
    
    expect(graph.stats.totalFiles).toBe(2); // Only entry.ts and helper.ts
    expect(graph.files.map(f => f.path).sort()).toEqual(["src/entry.ts", "src/helper.ts"]);
  });

  it("should handle re-exports correctly", () => {
    const project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        target: 99,
        module: 99,
      },
    });

    project.createSourceFile(
      "/project/src/core.ts",
      `export const core = "core";`
    );

    project.createSourceFile(
      "/project/src/index.ts",
      `export { core } from "./core.ts";`
    );

    const result = getModuleGraph(project, {
      rootDir: "/project",
      entryPoints: ["/project/src/index.ts"],
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;

    const { graph } = result.value;
    
    const indexFile = graph.files.find(f => f.path === "src/index.ts");
    expect(indexFile?.exports).toContain("src/core.ts");
  });
});