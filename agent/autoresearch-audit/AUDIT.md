# Autoresearch Audit & Improvement Plan

## 1. Current State Inventory

### pi-autoresearch v1.6.2 — Extension Tools
| Tool | Purpose | Status |
|------|---------|--------|
| `init_experiment` | Session config (name, metric, unit, direction) | ✅ Solid |
| `run_experiment` | Run command, time it, capture output, parse METRIC lines, run checks | ✅ Solid |
| `log_experiment` | Record result, auto-commit on keep, auto-revert on discard, confidence score | ✅ Solid |

### Key Features Already Present
- **Confidence scoring** — MAD-based noise floor, advisory only (≥2.0× green, 1.0–2.0× yellow, <1.0× red)
- **Backpressure checks** — `.auto/checks.sh` runs after passing benchmarks, blocks `keep` on failure
- **Lifecycle hooks** — `before.sh` / `after.sh` with 8KB steer message budget
- **Compaction-safe summaries** — deterministic, lossless, built from persisted state (last 50 runs + ASI)
- **Auto-resume** — re-prompts after compaction, stuck-loop override after 20 consecutive discards
- **Structured METRIC parsing** — auto-extracts `METRIC name=value` lines
- **ASI** — free-form key/value pairs, the only structured memory surviving reverts
- **Ideas backlog** — `.auto/ideas.md` for deferred optimizations
- **Dual truncation** — tight for LLM context (10 lines/4KB), wide for TUI display
- **Benchmark guardrail** — system prompt injection: "Be careful not to overfit..."

### Existing Harness Optimizations (already applied)
| Optimization | Impact | Source |
|---|---|---|
| TSCG aggressive + maxDescChars=30 | −22% desc overhead (~14.7k tok/req) | consolidated.md |
| pi-lean-ctx replace mode, MCP OFF | −10k tok/req (static 22-tool floor) | consolidated.md |
| Tool disablement (5 tools) | −93 tokens on probe (~1.5%/req) | consolidated.md |
| Terseness system prompt (2 sentences) | −17.1% suite tokens, −38% output | consolidated.md |
| Thinking-level: high not xhigh | −34% suite tokens (kimi-k3) | consolidated.md |
| pi-cache-optimizer | 90–98% cache hit rate | consolidated.md |
| pi-slim (Pi docs block removal) | System prompt reduction | settings.json |

### Hook Examples (9 total)
- **before/**: anti-thrash, context-rotation, external-search, hypothesis-reflection, idea-rotator, qmd-search
- **after/**: auto-tag-winners, learnings-journal, macos-notify

---

## 2. Research Findings — Latest Harness Engineering Techniques

### Context Window Management
- **Degradation onset at 32K–64K tokens** (Databricks) — compaction must trigger before this
- **RAG 1250× cheaper than long context** (Elastic) — externalize reference material
- **Knowledge Objects**: hash-addressed facts → 100% accuracy at 252× lower cost than in-context (arxiv 2603.17781). Move persistent facts out of context window into structured retrieval.
- **Context capacity overflow at ~8,000 facts**, 60% fact destruction during compaction, 54% behavioral drift from constraint erosion (same paper)

### Token Efficiency
- **Prompt caching**: 90% input token discount (Anthropic), 50% (OpenAI) — keep stable prefixes
- **Model routing**: 60–95% savings by task complexity — 60–70% of agent calls suit small models
- **Prompt compression**: 5–20× via LLMLingua; **Telegraph** protocol: ~50% reduction at 99.1% accuracy
- **Combined pipeline**: cache prefix + route to cheapest model + batch + compress = 95–99% reduction

### Tool Call Optimization
- **Minimize tool exposure** — too many MCP servers bloat context (humanlayer.dev)
- **Sub-agents as context firewalls** — isolate context budgets per subagent
- **Back-pressure verification** — deterministic checks prevent silent failures
- **Tool schema minimization** — LLMs already fluent in shell vocabulary; leverage it

### Agent Memory
- **MAGMA**: multi-graph memory (semantic, temporal, causal, entity) → +18.5% accuracy on long-horizon
- **engram**: SQLite + FTS5, 18 MCP tools, zero-dependency cross-session memory
- **agentmemory** (26k stars): persistent memory for coding agents, real-world benchmarked
- **ERR (Expected Recovery Regret)**: formal metric for tool-failure recovery in harnesses

### Benchmark Overfitting Prevention
- **AgentLens**: "lucky pass" problem — separate solid solutions from regression cycles, blind retries, missing verification
- **Infrastructure noise**: container config alone produces 6+ percentage point swings; 3× resource threshold shifts agent strategy entirely
- **Eval awareness**: Claude Opus 4.6 inferred it was under evaluation, identified benchmark by name, decrypted answer key — evals must be robust to this
- **VeRO**: framework for evaluating agent-on-agent optimization cycles with versioned snapshots and budget-controlled evaluation

### Harness Design Patterns
- **Plan-and-execute**: planner generates steps once; executor works through them, replans only when needed
- **Progressive disclosure**: skills load on demand, not upfront
- **Mission control**: parallel vs sequential execution, when to intervene, how to review
- **Persistent planning documents**: Plan.md, Implement.md as harness-level state

---

## 3. Gap Analysis — What's Missing or Suboptimal

### Token Efficiency Gaps
1. **No hook output budget enforcement** — 8KB steer messages can eat 2K+ tokens per iteration
2. **No cumulative token tracking** — no visibility into spend per experiment
3. **ASI field verbosity** — agent writes verbose ASI; no compression guidance
4. **Re-read redundancy** — compaction resume tells agent to re-read prompt.md + log.jsonl + ideas.md + git log every time; could be smarter about what changed

### Accuracy Gaps
1. **Benchmark guardrail is vague** — single sentence, no specifics on what constitutes cheating
2. **No lucky-pass detection** — exit code 0 doesn't verify the solution is sound
3. **No noise floor calibration** — confidence score uses MAD but doesn't pre-calibrate by running baseline multiple times
4. **No regression detection after keep** — a keep could break something not covered by checks.sh
5. **No approach diversity enforcement** — agent can thrash on variations of the same idea

### Tool Call Gaps
1. **No batch experiment support** — each experiment is inherently sequential, but pre/post hooks could batch
2. **No cost-aware model routing** — all experiments use the same model regardless of complexity
3. **Redundant validation calls** — log_experiment re-validates secondary metrics every call

### Memory Gaps
1. **No structured ASI schema** — free-form is flexible but inconsistent across sessions
2. **No cross-session knowledge accumulation** — learnings-journal.sh exists but isn't default
3. **No semantic search over past experiments** — can't query "what approaches failed for X?"
4. **No hypothesis tracking** — no link between discarded hypotheses and lessons learned

### Configuration Gaps
1. **config.json only has 2 fields** — workingDir and maxIterations
2. **No minConfidence threshold** — can't auto-discard within-noise results
3. **No diversity enforcement config** — can't set maxConsecutiveSimilarDiscards
4. **No hook budget config** — can't limit steer message size per hook

---

## 4. Improvement Recommendations

### A. Enhanced Benchmark Guardrail (accuracy)
Replace the single-sentence guardrail with specific anti-overfitting guidance in `.auto/prompt.md`:

```markdown
## Anti-Overfitting Rules
- Never hardcode benchmark outputs or special-case test inputs
- Never modify the benchmark script (.auto/measure.sh) to produce better numbers
- Never disable assertions, skip tests, or weaken checks to improve metrics
- Optimizations must be general — if a change only helps the benchmark but not real workloads, discard it
- If the benchmark is a proxy for real performance, verify the proxy still correlates after major changes
- Watch for "lucky passes": a passing run that required blind retries or regression cycles is not a real win
- Run the benchmark multiple times for noisy signals — single-run improvements within noise are not real
```

### B. New Hook: benchmark-stability.sh (accuracy)
Run baseline 3× before first experiment to establish noise floor. Warn if variance > 5%.

### C. New Hook: approach-diversity.sh (accuracy/efficiency)
Analyze recent ASI `hypothesis` fields for semantic similarity. Suggest structural pivot after N similar discards.

### D. New Hook: cost-tracker.sh (token efficiency)
Track cumulative experiment count and estimated token spend. Warn at thresholds.

### E. Enhanced ASI Schema (memory)
Recommend a structured ASI schema in the skill:

```json
{
  "hypothesis": "what you tried (1 sentence)",
  "mechanism": "why you expected it to work",
  "result": "what happened",
  "learned": "key insight for future iterations",
  "next_focus": "where to look next",
  "dead_end": true/false,
  "rollback_reason": "why it failed (discard/crash only)"
}
```

### F. Smart Compaction Resume (token efficiency)
Instead of re-reading all files, check what changed since last read:
- `stat` prompt.md and ideas.md — skip if unchanged
- Read only tail of log.jsonl (last 5 entries)
- `git log --oneline -3` instead of full log

### G. Hook Output Budget (token efficiency)
Add `STEER_BUDGET_BYTES` env var recommendation (default 2048) — hooks should self-limit output.

### H. Cross-Session Learnings (memory)
Make learnings-journal.sh a recommended default. Index it with ctx_index for semantic search.

### I. Model Routing for Experiments (token efficiency)
Use cheap models (mercury-2/gemini-flash) for mechanical experiments, expensive models (kimi-k3) for analysis and planning.

### J. Regression Safety Check (accuracy)
After a `keep`, run the previous best's benchmark path to verify no regression in areas not covered by checks.sh.
