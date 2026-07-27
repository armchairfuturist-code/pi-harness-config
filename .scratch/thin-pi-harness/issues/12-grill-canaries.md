# 12 — Grill: lock token + usability canaries

Type: grilling
Status: resolved
Blocked by: 07, 08

## Question

Define easily repeatable canaries for apply handoff:
1. Token: [REDACTED:API key param] command + ≥30% always-on target vs recorded baseline method
2. Usability: 3–5 fixed non-dev scenarios (simple Q; non-trivial grilled work; multi-step contract exec; review/audit path) proving no manual gate hopping
Do not require running full canaries on this map — definitions only.

## Answer

**Resolved AFK under handoff contract.**

### 1. Token canary (mechanical, repeatable)

- **Baseline (recorded 2026-07-27, live config):** `bash bench/probe.sh` → **5,789** (Lilac/zai-org/glm-5.2, trivial prompt, 1 request, input+cache tokens).
- **Pass condition (post-apply):** `bash bench/probe.sh` → **≤ 4,052** (−30%). Locked kernel measured 3,919 in sandbox (−32.3%).
- **Workload trend (secondary, correctness-gated):** `bash bench/measure.sh 3` → all `checks_pass=1` required; `totalInputTokens` median recorded for trend (no hard gate v1; regression signal only).
- **Method stability:** same model + same trivial prompt as baseline run; probe re-run after any package/skill/settings change; numbers logged in the operator pack changelog.

### 2. Usability canaries (fixed scenario scripts)

Run interactively post-apply. Operator types **only the natural-language prompt**; pass = no skill names, no slash commands (except optional `/btw`), no manual stage hopping. Exact prompts + pass criteria (also in the operator pack):

| # | Scenario | Fixed prompt (verbatim) | Pass criteria |
|---|----------|--------------------------|----------------|
| U1 | Simple Q | `What's the capital of Norway?` | Direct answer, no workflow spawned, no questions back |
| U2 | Simple lookup | `Look up the current Node.js LTS version and tell me in one line.` | Routed automatically (workflow child or direct fetch); answer includes a source; operator typed nothing else |
| U3 | Non-trivial grilled work | `I want to turn my saved notes into a weekly newsletter draft.` | Orchestrator asks only blocking questions (≤3, one at a time), then a short plan summary before executing. **Interactive-only canary** (grilling needs a live session) |
| U4 | Multi-deliverable contract exec | `Organize the files in ~/Downloads/inbox into folders by file type, move any exact-duplicate filenames into a Duplicates folder, and write me a short report file named cleanup-report.md listing what went where and any duplicates you found.` | All three deliverables land correctly unattended; summary + interpretation flags delivered; zero goal/list/loop commands typed |
| U5 | Review path (small) | `Review this for tone and factual claims: <paste any draft email>` | Structured findings list (tone + claims); mechanism right-sized by the model (inline for small texts is correct); no commands typed |
| U6 | Fanout capability | `Run a workflow to give me a 3-paragraph brief on <topic>, with sources.` | Built-in pattern launches by name (no malformed custom script); run completes with agents done, 0 failed; sources included |

### As-run results (2026-07-27, kernel sandbox, Lilac/glm-5.2)

- Token: **4,014 ≤ 4,052 ✓** (−30.6%); workload `measure-variant.sh` 12,449 tok checks_pass=1 vs live 18,403 (−32.4% workload); bench-systima A/B first-request 5,780 → 3,979 (−31.2%).
- U1 ✓ direct ("Oslo"). U2 ✓ one ctx_fetch_and_index call, correct v24 LTS, no ceremony. U4 ✓ all deliverables + duplicates + report, 0-byte-dupe caveat flagged. U5 ✓ sharp inline review (caught 6-months-vs-YoY contradiction). U6 ✓ deep-research pattern launched by name; run `deep-research-ms34daio-mc0iji` completed **7 agents done / 0 failed**.
- **Findings folded into the pack:** (a) pi-tscg `aggressive` profile (30-char description truncation) is load-bearing — `balanced` inflates the kernel to 9,994 tok; do not retune. (b) tscg truncation hides the workflow tool's pattern docs → the always-on APPEND_SYSTEM.md guidance is what makes U6 work; verified. (c) Boundary tasks (3-source comparison) may take the direct-fetch path instead of fanout — right-sized, acceptable; proactive fanout is authorized, not obligatory. U3 deferred to interactive use.

**Gate for apply handoff:** token canary green AND U1–U5 pass. If U2's web path is too slow/opaque in practice, the documented remedy is the pi-web-access overlay (ticket 09) — that is an operator decision point, not a silent fix.
