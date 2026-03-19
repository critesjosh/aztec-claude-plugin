# Evaluation Framework

Measures whether the aztec-claude-plugin skills actually improve Claude's output quality for Aztec development tasks.

## Prerequisites

Install the **skill-creator** plugin — it provides automated grading, benchmarking, description optimization, and a review viewer:

```bash
claude plugins add skill-creator@claude-plugins-official
```

## Quick Summary

The evaluation uses the [skill-creator](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/skill-creator) plugin's toolchain to:

1. **A/B test** skill quality (with-skill vs without-skill runs)
2. **Grade** outputs against assertions automatically
3. **Optimize** skill descriptions for trigger accuracy
4. **Visualize** results in a browser-based review UI

Tests run against a **minimal scaffold project** (not a fully-documented repo) to measure the skill's real-world value for developers starting fresh.

## Test Bed: Scaffold

The scaffold simulates a developer starting a new Aztec project — no CLAUDE.md, no existing tests, no utility code:

```
evals/scaffold/
├── Nargo.toml              # Aztec deps (v4.1.0-rc.2)
├── package.json            # @aztec/* TS deps
├── tsconfig.json
├── jest.integration.config.json
├── src/
│   ├── main.nr             # Simple Token contract (mint, transfer, shield)
│   └── balance_note.nr     # Private balance note
└── (NO CLAUDE.md, NO tests, NO scripts, NO utils)
```

Setup: `cd evals/scaffold && yarn install && yarn compile && yarn codegen`

**Why a scaffold?** Testing against a full repo like aztec-starter is misleading — Claude copies patterns from CLAUDE.md and existing tests, making skills appear redundant. The scaffold isolates the skill's contribution.

## Using the Skill-Creator Plugin

The skill-creator plugin provides the full eval lifecycle. Use it by asking Claude:

### 1. A/B Comparator Tests

Ask Claude to run the skill-creator's eval workflow:

```
Run A/B comparator tests for the aztec-developer skill against the scaffold.
Use the skill-creator plugin to spawn with-skill and without-skill runs,
grade them, and show the results in the eval viewer.
```

The skill-creator will:
- Spawn subagents for each test case (one with the skill, one without)
- Save outputs to `<skill>-workspace/iteration-N/eval-<name>/{with_skill,without_skill}/outputs/`
- Grade each output against assertions → `grading.json`
- Aggregate into `benchmark.json` with pass rates, timing, token usage
- Launch the eval viewer for qualitative review

### 2. Description Optimization (Trigger Accuracy)

The skill-creator can optimize skill descriptions so they trigger reliably:

```
Optimize the description for the aztec-developer skill.
Use the skill-creator's description optimization workflow.
```

This runs `scripts/run_loop.py` which:
- Takes a set of should-trigger / should-not-trigger queries
- Tests the current description against them (3 runs each for reliability)
- Uses Claude to propose improved descriptions
- Evaluates on a held-out test set to avoid overfitting
- Returns the best description after up to 5 iterations

### 3. Grading & Benchmarking

After running tests, the skill-creator grades and aggregates:

```
Grade the latest iteration of aztec-developer eval runs
and generate the benchmark report.
```

This produces:
- `grading.json` per run (assertion pass/fail with evidence)
- `benchmark.json` (aggregate stats: mean ± stddev for pass rate, time, tokens)
- `benchmark.md` (human-readable summary)

### 4. Eval Viewer

The skill-creator provides an HTML viewer for side-by-side review:

```
Launch the eval viewer for the latest aztec-developer iteration.
```

The viewer shows:
- **Outputs tab**: Each test case with with-skill and without-skill outputs side by side
- **Benchmark tab**: Pass rates, timing, and analyst observations
- **Feedback**: Text fields for qualitative notes per test case

## Eval Definitions

Test prompts and assertions are in `evals/comparator-tests/evals.json`. Each test case follows the skill-creator schema:

```json
{
  "skill_name": "aztec-developer",
  "evals": [
    {
      "id": 1,
      "prompt": "Review the Token contract for security issues",
      "expected_output": "Structured review with severity levels, no false positives about Noir overflow or note randomness",
      "expectations": [
        "Does NOT claim Noir u64 wraps on overflow",
        "Does NOT claim BalanceNote is missing randomness",
        "Does NOT claim double .at(caller) is a bug",
        "Identifies the missing unshield/transfer_private functions",
        "Mentions enqueue_incognito for the shield function"
      ]
    }
  ]
}
```

Trigger eval queries for description optimization are in `evals/trigger-tests/`:

```json
[
  {"query": "I need to write a private transfer function in my Aztec contract but I'm not sure how notes work", "should_trigger": true},
  {"query": "Deploy my Next.js app to Vercel", "should_trigger": false}
]
```

## Directory Structure

```
evals/
├── README.md                              ← this file
├── history.json                           ← iteration tracking
├── scaffold/                              ← minimal Token contract test bed
│   ├── Nargo.toml, package.json
│   └── src/main.nr, balance_note.nr
├── comparator-tests/
│   ├── evals.json                         ← test definitions + assertions
│   ├── iteration-1/                       ← HISTORICAL: aztec-starter, tools disabled
│   ├── iteration-2/                       ← HISTORICAL: aztec-starter, tools enabled
│   └── iteration-3/                       ← scaffold, tools enabled (manual grading)
├── trigger-tests/                         ← trigger eval queries per skill
├── e2e-tasks/results.md                   ← task results
└── report/assessment.md                   ← analysis + recommendations
```

## Key Findings

| Iteration | Test Bed | Skill Delta | Key Insight |
|-----------|----------|-------------|-------------|
| 1 | aztec-starter, tools off | +2.25 | Skills compensate for stale training data |
| 2 | aztec-starter, tools on | +0.25 | Claude copies from existing code — skills redundant |
| 3 | **Scaffold**, tools on | **+1.0** | Skills prevent framework hallucinations |

The **contract review** skill (review-contract) showed the largest delta (+2.0) — without it, Claude made 3 false claims about Aztec internals (Noir overflow, note randomness, Owned indexing). This led to consolidating 8 skills → 2 (aztec-developer + review-contract).

## Running a Full Eval Cycle

```
1. Ask Claude to run the skill-creator eval workflow for aztec-developer
   against the scaffold, with test prompts from evals/comparator-tests/evals.json
2. Review outputs in the eval viewer
3. If pass rates are low, iterate on the skill
4. When satisfied, run description optimization via skill-creator's run_loop
5. Update assessment.md with results
```
