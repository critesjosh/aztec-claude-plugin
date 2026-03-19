# Trigger Accuracy — Baseline Results

**Date**: 2026-03-19
**Model**: sonnet
**Runs per query**: 1
**Timeout**: 45s

## Results Summary

| Skill | Pass Rate | Should-Trigger | Should-NOT-Trigger | Notes |
|-------|-----------|:-:|:-:|-------|
| aztec-developer | 8/17 (47%) | 0/9 (0%) | 8/8 (100%) | Zero positive triggers |
| review-contract | 9/16 (56%) | 1/8 (13%) | 8/8 (100%) | Only "Audit access control" triggered |
| aztec-deploy | 10/16 (63%) | 2/8 (25%) | 8/8 (100%) | "Deployment workflow" + "Deploy with SponsoredFPC" triggered |
| aztec-accounts | 10/16 (63%) | 2/8 (25%) | 8/8 (100%) | "Recover account" + "Generate keys" triggered |
| aztec-e2e-testing | 8/16 (50%) | 0/8 (0%) | 8/8 (100%) | Zero positive triggers |
| aztec-typescript | 8/16 (50%) | 0/8 (0%) | 8/8 (100%) | Zero positive triggers |
| aztec-contract-dev | 6/14 (43%) | 0/8 (0%) | 6/6 (100%) | Zero positive triggers |
| aztec-testing | 6/14 (43%) | 0/8 (0%) | 6/6 (100%) | Zero positive triggers |

## Key Findings

### Pattern: 100% Specificity, Near-Zero Sensitivity

All skills achieve **perfect specificity** (never trigger for unrelated prompts) but **near-zero sensitivity** (rarely trigger for relevant prompts). Claude answers Aztec questions directly from training data rather than invoking the skill.

### What Triggered (the 5 successful triggers)

| Query | Skill | Why It Worked |
|-------|-------|---------------|
| "What's the correct deployment workflow for Aztec?" | aztec-deploy | Keyword match: "deployment" in description |
| "Deploy my contract with SponsoredFPC" | aztec-deploy | Specific: "SponsoredFPC" is distinctive enough |
| "How do I recover an Aztec account from saved credentials?" | aztec-accounts | Specific: "recover" + "credentials" matches description |
| "Generate secret key and signing key for an Aztec wallet" | aztec-accounts | Specific: "secret key" + "signing key" are technical terms |
| "Audit the access control in my Aztec contract" | review-contract | Keyword: "Audit" + "access control" signals review intent |

### What Didn't Trigger (pattern analysis)

Generic questions ("How do notes work?", "What storage types are available?") never trigger because Claude can answer them from general knowledge. The description text doesn't create enough **urgency** for Claude to consult the skill.

### Description Quality Assessment

Skills that triggered had descriptions with **specific action verbs and nouns** that matched the query:
- "deployment scripts" → matched "deployment script"
- "recovery from credentials" → matched "recover from saved credentials"

Skills that never triggered had **generic descriptions**:
- "Patterns for Aztec development" (aztec-developer) — too broad
- "Assists with testing Aztec smart contracts" (aztec-testing) — not action-oriented
- "Generate TypeScript client code" (aztec-typescript) — too broad

### Recommendations for Description Improvement

1. **Include specific trigger phrases** that users actually type (e.g., "TXE", "TestEnvironment", "Nargo.toml")
2. **Add urgency signals** like "MUST consult before writing Aztec code" or "Contains patterns Claude doesn't know from training"
3. **List specific non-obvious topics** the skill covers that Claude wouldn't know (e.g., "simulate-before-send pattern", "registerSender requirement")
4. **Use conditional trigger language**: "Use when the user mentions X, Y, or Z"

## Optimization Loop Status

Running `run_loop.py` with 3 iterations on:
- aztec-deploy (baseline: 25% sensitivity)
- aztec-developer (baseline: 0% sensitivity)
- review-contract (baseline: 13% sensitivity)
