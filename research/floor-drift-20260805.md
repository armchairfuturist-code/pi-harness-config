# Floor drift analysis — 2026-08-05

Baseline: **4,014 tok** (CE-lite thin kernel, commit `c9cd69f`, 2026-07-27; reconciled
4,014 ≈ 3,979 ≈ 4,003 across probe.sh + bench-systima on 2026-07-29).
Current floor: **5,251 tok** (cold-gated probe, Lilac/zai-org/glm-5.2, 3 reproducible reads: 5,251 / 5,252 / 5,250).
**Drift: +1,237 tok (+30.8%).**

## Evidence matrix (single-removal probes, variant built from repo working tree)

| Component | Baseline tok | Current tok | Δ | Evidence |
|---|---:|---:|---:|---|
| last30days-pi package | 0 (absent at c9cd69f) | +440 | **+440** | c9cd69f settings has 0 last30days; removal 5,251→4,811 |
| APPEND_SYSTEM.md (trigger map) | 84 | 370 | **+286** | c9cd69f=413 B → now=1,501 B (commit 41d5f6b); removal 5,251→4,881 |
| base floor (core prompt+tools, AGENTS, model-agents providers) | ~7,718 net | ~8,297 net | **+579** | residual after all named components attributed |
| pi-dynamic-workflows | 627 | 626 | ~0 | removal 5,251→4,625; v3.5.0 (07-31) added lazy workflow files, not schema |
| context-mode | 1,757 | 1,759 | ~0 | removal 5,251→3,492; v1.0.169 unchanged since 07-15 |
| pi-lean-ctx | 616 | 547 | −69 | removal 5,251→4,704; 3.9.8→3.9.17 slightly reduced surface |
| rot-sentinel / transcript-pruner / session-index exts | 0 | ~0 | 0 | each removal 5,251→5,249 (lazy/zero-token, confirmed) |
| model-agents.json per-model prompts | 0 | ~0 | 0 | emptying 5,251→5,249 (no glm-5.2 prompt injected) |

Combined check: minus last30days + APPEND = 4,443 (Δ −808 = 440+370, additive).
Apples-to-apples residual (both sans APPEND/last30days): 4,443 vs (4,014−84)=3,930 = **+513**,
consistent with the +579 base-floor estimate (within per-probe ±noise).

## Drift classification

**Operator-config drift (reversible choices):**
- `last30days-pi` +440 — added post-baseline; 2 tool schemas (last30days_research/diagnose).
  Keep if the research tool is used; otherwise drop to recover 440 tok.
- `APPEND_SYSTEM.md` trigger map +286 — commit 41d5f6b added plain-language hooks for all
  on-demand skills (413 B → 1,501 B). Trade-off: proactive routing quality vs 286 tok/turn.

**Platform drift (not operator-reversible without pinning):**
- ~+579 base floor — most likely pi harness upgrade 0.81.1 → 0.83.0 (core system prompt /
  core tool schemas grew) + model-agents.json providers block growth (deepseek-v4-flash added
  44d32f6/b817e5f; Venice trimmed 105→53). AGENTS_full/terse unchanged (no commits).

**Config-state drift (does NOT affect the Lilac-measured floor):**
- repo `settings.json` has an uncommitted switch of defaultProvider/defaultModel to
  Venice/openai-gpt-56-terra; live still runs Lilac/zai-org/glm-5.2. Deploying it would move
  the floor to a different tokenizer — not comparable to the 4,014 baseline.

## Measurement gotcha (record to prevent re-injury)
Restarting the lean-ctx daemon (`pkill lean-ctx`) during probes triggers the doubled-agent-dir
phantom (#930): the fresh daemon boots on defaults (no replace mode) → tool surface 22→78,
+~9.6k tok → reads ~14,747. The true 5,251 only holds while the daemon retains replace-mode
config. **Do not kill lean-ctx between probes.**

## Method
build-variant.sh (TSCG_PROXY_LILAC=1) → cold-gated through capture proxy (4599) →
`pi -p "Reply with exactly: OK" --model Lilac/zai-org/glm-5.2` → sum(input+cacheRead+cacheWrite)
from session jsonl (cache-invariant = true prompt size). Removal probes edit the variant
settings.json/APPEND_SYSTEM in place; lean-ctx daemon left running.
