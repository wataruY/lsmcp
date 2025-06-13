# Claude Orchestrator: A System for Efficiently Decomposing and Executing Complex Tasks

## tl;dr

- Created a Claude Code version of Roo Orchestrator
- Unlike Roo which doesn't support parallel tasks, Claude Code's Task can execute in parallel

## Introduction

I've been a regular user of Roo Orchestrator and wanted a Claude version of it.

Roo Orchestrator breaks down tasks step by step, decomposing them into individual subtasks. Subtasks run as independent sessions and return summaries to their parent upon completion.

https://zenn.dev/tesla/articles/4be4ff326e020c

This works quite efficiently. Depending on the case, tasks that previously cost $6 can now compress context to under $1. The execution is also faster.

This time, I created an Orchestrator prompt that efficiently decomposes and executes complex tasks using the `.claude/commands` directory.

## Background: Task Tool and `.claude/commands` System

Claude Code has similar mechanisms for subtask splitting: checklist generation and the Task tool.

It launches itself as an MCP server and receives tasks from the parent.

https://blog.lai.so/claude-code-into/

https://spiess.dev/blog/how-i-use-claude-code

Additionally, Claude Code allows you to define custom commands for each project. By placing Markdown files in `.claude/commands/*.md`, they become available as commands.

```
.claude/
└── commands/
    ├── orchestrator.md      # Complex task decomposition and execution
    └── commit-with-check.md # Commit after testing
```

Commands can be executed in the format `/project:command-name`.

Examples:

- `/project:orchestrator analyze test lint and commit`
- `/project:commit-with-check`

## project:orchestrator Command

I fed Roo's prompt and instructed it to use Task, generating a prompt that works effectively on itself.

````md:.claude/commands/orchestrator.md
# Orchestrator

Split complex tasks into sequential steps, where each step can contain multiple parallel subtasks.

## Process

1. **Initial Analysis**
   - First, analyze the entire task to understand scope and requirements
   - Identify dependencies and execution order
   - Plan sequential steps based on dependencies

2. **Step Planning**
   - Break down into 2-4 sequential steps
   - Each step can contain multiple parallel subtasks
   - Define what context from previous steps is needed

3. **Step-by-Step Execution**
   - Execute all subtasks within a step in parallel
   - Wait for all subtasks in current step to complete
   - Pass relevant results to next step
   - Request concise summaries (100-200 words) from each subtask

4. **Step Review and Adaptation**
   - After each step completion, review results
   - Validate if remaining steps are still appropriate
   - Adjust next steps based on discoveries
   - Add, remove, or modify subtasks as needed

5. **Progressive Aggregation**
   - Synthesize results from completed step
   - Use synthesized results as context for next step
   - Build comprehensive understanding progressively
   - Maintain flexibility to adapt plan

## Example Usage

When given "analyze test lint and commit":

**Step 1: Initial Analysis** (1 subtask)
- Analyze project structure to understand test/lint setup

**Step 2: Quality Checks** (parallel subtasks)
- Run tests and capture results
- Run linting and type checking
- Check git status and changes

**Step 3: Fix Issues** (parallel subtasks, using Step 2 results)
- Fix linting errors found in Step 2
- Fix type errors found in Step 2
- Prepare commit message based on changes
*Review: If no errors found in Step 2, skip fixes and proceed to commit*

**Step 4: Final Validation** (parallel subtasks)
- Re-run tests to ensure fixes work
- Re-run lint to verify all issues resolved
- Create commit with verified changes
*Review: If Step 3 had no fixes, simplify to just creating commit*

## Key Benefits

- **Sequential Logic**: Steps execute in order, allowing later steps to use earlier results
- **Parallel Efficiency**: Within each step, independent tasks run simultaneously
- **Memory Optimization**: Each subtask gets minimal context, preventing overflow
- **Progressive Understanding**: Build knowledge incrementally across steps
- **Clear Dependencies**: Explicit flow from analysis → execution → validation

## Implementation Notes

- Always start with a single analysis task to understand the full scope
- Group related parallel tasks within the same step
- Pass only essential findings between steps (summaries, not full output)
- Use TodoWrite to track both steps and subtasks for visibility
- After each step, explicitly reconsider the plan:
  - Are the next steps still relevant?
  - Did we discover something that requires new tasks?
  - Can we skip or simplify upcoming steps?
  - Should we add new validation steps?

## Adaptive Planning Example

```
Initial Plan: Step 1 → Step 2 → Step 3 → Step 4

After Step 2: "No errors found in tests or linting"
Adapted Plan: Step 1 → Step 2 → Skip Step 3 → Simplified Step 4 (just commit)

After Step 2: "Found critical architectural issue"
Adapted Plan: Step 1 → Step 2 → New Step 2.5 (analyze architecture) → Modified Step 3
```
````

This might be redundant. While it could be trimmed down, since the orchestrator has plenty of context window available, a longer version seems fine.

## Example: Using in TypeScript MCP Project

I was experimenting here:

https://github.com/mizchi/typescript-mcp

### Execution Command

```bash
# Initial prompt
/project:orchestrator analyze test lint and commit

● I'll help you analyze, test, lint, and commit your TypeScript MCP project. Let me break
  this down into sequential steps with parallel subtasks.
  ⎿  ☐ Step 1: Initial Analysis - Understand project structure and test/lint setup
     ☐ Step 2: Quality Checks - Run tests, linting, and check git status
     ☐ Step 3: Fix Issues - Address any errors found in Step 2
     ☐ Step 4: Final Validation and Commit

● Step 1: Initial Analysis
  ⎿  ☐ Step 1: Initial Analysis - Understand project structure and test/lint setup
     ☐ Step 2: Quality Checks - Run tests, linting, and check git status
     ☐ Step 3: Fix Issues - Address any errors found in Step 2
     ☐ Step 4: Final Validation and Commit

● Task(Analyze project structure)
  ⎿  Done (7 tool uses · 17.8k tokens · 44.2s)
  ⎿  ☒ Step 1: Initial Analysis - Understand project structure and test/lint setup
     ☐ Step 2: Quality Checks - Run tests, linting, and check git status
     ☐ Step 3: Fix Issues - Address any errors found in Step 2
     ☐ Step 4: Final Validation and Commit


# ... intermediate state

● Step 2: Quality Checks (parallel execution)

● Task(Run tests)
  ⎿  Done (1 tool use · 16.4k tokens · 30s)

● Task(Run linting and type checking)
  ⎿  Done (2 tool uses · 14.8k tokens · 26.1s)

● Task(Check git status)
  ⎿  Done (6 tool uses · 15.8k tokens · 37.3s)
  ⎿  ☒ Step 1: Initial Analysis - Understand project structure and test/lint setup
     ☒ Step 2: Quality Checks - Run tests, linting, and check git status
     ☐ Step 3: Fix Issues - Address any errors found in Step 2
     ☐ Fix ESLint errors in lspGetDiagnostics.ts (2 errors)
     ☐ Fix ESLint errors in lspGetHover.ts (4 errors)
     ☐ Fix ESLint error in tsMoveDirectory.ts (unbound method)
     ☐ Fix TypeScript error in tsMoveDirectory.ts (typeof Project)
     ☐ Step 4: Final Validation and Commit

# ...final state

● All fixes completed, tests and linting passed successfully!
● Bash(git add -A && git commit -m "fix: resolve linting and type errors in LSP and
      TypeScript tools…)
  ⎿  [main 282a888] fix: resolve linting and type errors in LSP and TypeScript tools
      5 files changed, 115 insertions(+), 20 deletions(-)
      create mode 100644 .claude/commands/commit-with-check.md
      create mode 100644 .claude/commands/orchestrator.md
  ⎿  ☒ Step 1: Initial Analysis - Understand project structure and test/lint setup
     ☒ Step 2: Quality Checks - Run tests, linting, and check git status
     ☒ Fix ESLint errors in lspGetDiagnostics.ts (2 errors)
     ☒ Fix ESLint errors in lspGetHover.ts (4 errors)
     ☒ Fix ESLint error in tsMoveDirectory.ts (unbound method)
     ☒ Fix TypeScript error in tsMoveDirectory.ts (typeof Project)
     ☒ Step 3: Fix Issues - Address any errors found in Step 2
     ☒ Step 4: Final Validation and Commit
```

## Conclusion

After trying several patterns, these instructions were ultimately effective:

- Initially analyze the code broadly to plan subtask decomposition and steps
- Parallelize within subtask execution steps
- At each step, reconsider whether the current subtask plan is appropriate based on the previous task's execution results
  - Without this, the cost of rework is high when plans break down. Essentially, make it agile-like

In this example, we were able to automatically execute a series of tasks "analyze → test → fix → commit" in a structured way.

Well, I'm influenced by Roo and feel there might be better ways to utilize Task, but I'll go with this for now.