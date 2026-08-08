# HIL Meta-Monitoring Ledger

> Tracks which interventions are still load-bearing. Flags those that may have become
> unnecessary overhead. Re-checks especially after model upgrades.

| Intervention | Applied | ETCLOVG Layer | Last Checked | Status | Re-check After | Notes |
|---|---|---|---|---|---|---|
| tscg compression | 2026-07-14 | T (Tooling) | 2026-07-28 | **load-bearing** (saves 6,467 tok) | next model upgrade | Highest-leverage safe optimization |
| pi-slim | 2026-07-14 | T (Tooling) | 2026-07-28 | **load-bearing** (saves 323 tok) | next model upgrade | Modest savings |
| APPEND_SYSTEM tightening | 2026-07-28 | C (Context) | 2026-07-28 | **load-bearing** (saves 9 tok) | 2026-09-01 | Already minimal, diminishing returns |
| context-mode tools (ctx_*) | pre-2026 | T (Tooling) | 2026-08-07 | **load-bearing** | never | 1,757 tok; 16 tools. Cannot remove via settings.json — must uninstall from node_modules. |
| workflows tool | pre-2026 | T (Tooling) | 2026-08-07 | **load-bearing** | never | 627 tok; tools registered via extensions/ dir, not settings.json. Package provides execution backend. |
| lean-ctx | pre-2026 | T (Tooling) | 2026-08-07 | **load-bearing (CRITICAL)** | never | 616 tok; removing causes +147% workload tokens + check failure. MCP bridge error is misleading — package provides essential hidden coupling. |
| thinking=high | 2026-07-30 | E (Execution) | 2026-07-30 | **load-bearing** (medium fails t3-r2) | next model upgrade | Must stay high for complex reasoning |
| CE-lite overlay doctrine | pre-2026 | C (Context) | 2026-07-30 | **load-bearing** (economy pressure breaks canaries) | next model upgrade | Do not compress without canary gate |
| skills (lazy loading) | pre-2026 | C (Context) | 2026-07-28 | **load-bearing** (0 tok, no cost) | never | No overhead, no risk |
| 9 free packages | 2026-07-28 | T (Tooling) | 2026-08-07 | **removed from settings** | N/A | Removed from settings.json in Iteration 1. 0 tokens, 0 tools — truly free. Still installed in node_modules. |

## Meta-monitoring triggers

1. **Model upgrade** → re-check ALL interventions. The model may now handle something the harness compensates for.
2. **Monthly sweep** → run ablation on each load-bearing intervention.
3. **Config-overhead drift** → if probe_total drifts from last baseline, investigate which component changed.

## Pending actions

- [ ] Build ctx-tool canary → then test context-mode/workflows/lean-ctx removal
- [ ] Remove the 9 free packages identified by config-overhead study — DONE (from settings.json, still in node_modules)
- [ ] Build multi-turn canary → then test compaction/lifecycle policies
- [x] Fix bench/probe.sh cache contamination (COLD_BUST=1 works correctly, cacheRead=0)
- [x] Sync models.json drift — N/A (generated file, no longer a drift issue)
- [x] Resolve rtk.ts drift — DONE (already in extensions-disabled/)
- [ ] Investigate 5 extra tools in ~/.pi/agent/ sessions (ctx_stats, ctx_doctor, ctx_upgrade, ctx_purge, ctx_insight)
- [ ] Investigate tscg compression level tuning (can it strip parameter descriptions?)
- [ ] Consider uninstalling unused packages from node_modules to remove tool schemas
- [ ] Improve observe.sh to run probe from ~/.pi/agent/ (actual working directory)
- [ ] Increase workload runs from 3 to 5 for better measurement reliability
- [x] Remove AGENTS.md symlink duplication at ~/.pi/AGENTS.md
