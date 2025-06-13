# Claude Orchestrator: 複雑なタスクを効率的に分解・実行する仕組み

## tl;dr

- Roo Orchestrator の Claude Code 版を作ってみた
- Roo は並列タスク未対応だが、 Claude Code の Task の並列実行ができる

## はじめに

普段から Roo Orchestrator を愛用していて、その Claude 版が欲しかった。

Roo Orchestrator はタスクを段階的に分解して、個別にサブタスクに分解する。サブタスクは独立したセッションとして動き、タスク完了後は親にそのサマリを返す。

https://zenn.dev/tesla/articles/4be4ff326e020c

これはかなり効率的に動く。場合によるが、今までだと $6 かかっていたようなタスクが、$1 未満にコンテキストを圧縮できていた。動作も速い。

今回は、`.claude/commands`ディレクトリを使って、複雑なタスクを効率的に分解・実行する Orchestrator プロンプトを作成した。

## 事前知識: Task Tool と `.claude/commands` の仕組み

Claude Code はサブタスク分割に、チェックリスト生成と Task ツールという似たような仕組みがある。

これは自身を MCP サーバーとして起動し、親からタスクを受け取る。

https://blog.lai.so/claude-code-into/

https://spiess.dev/blog/how-i-use-claude-code

また、Claude Code では、プロジェクトごとにカスタムコマンドを定義できる。`.claude/commands/*.md ` に Markdown ファイルを配置すると、それらがコマンドとして利用可能になる。

```
.claude/
└── commands/
    ├── orchestrator.md      # 複雑なタスクの分解実行
    └── commit-with-check.md # テスト後のコミット
```

コマンドは `/project:コマンド名` の形式で実行できる。

例：

- `/project:orchestrator analyze test lint and commit`
- `/project:commit-with-check`

## project:orchestrator コマンド

Roo の プロンプトを食わせて、 かつ Task を使うように指示して、自身に効くようなプロンプトを生成させた。

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

もしかしたら冗長かも。削れそうではあるが、オーケストレーターはコンテキストウィンドウに余裕があるので、長くても良さそう。

## 実行例：TypeScript MCP プロジェクトでの活用

ここで実験していた。

https://github.com/mizchi/typescript-mcp

### 実行コマンド

```bash
# 初期プロンプト
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


# ... 中間状態

● Step 2: Quality Checks (並列実行)

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

# ...最終的な状態

● すべての修正が完了し、テストとリンティングが正常に通過しました！
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

## おわり

何パターンか試したが、結果的に効いたのはこれらの指示

- 最初に大雑把にコードを調べ、サブタスクの分割とステップを計画する
- サブタスクの実行ステップ内は並列化する
- ステップごとに、一つ前のタスクの実行結果から現在のサブタスク計画が妥当か再考する
  - そのままだと計画が破綻した時に手戻りが大きい。要はアジャイルっぽくする

今回の例では、「分析 → テスト → 修正 → コミット」という一連の作業を、構造化された方法で自動実行できた。

まあ、Roo に引きずられて Task の活用方法にはもっといい方法がある気がするんだけど、一旦これでいく。
