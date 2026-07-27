# 07 — Grill: lock always-on topology

Type: grilling
Status: resolved
Blocked by: 01, 02, 05

## Question

What is the concrete always-on topology for the thin kernel? Decide: system prompt shape; essential tools; tool/skill search mechanism; overlays; near-zero skill descriptions; what may never be always-on; how this hits ≥30% under baseline. Human must confirm; agent recommends from inventory + research.

## Answer

**Resolved AFK under handoff contract.** All numbers measured 2026-07-27 with `bench/probe.sh` (live) and `bench/probe-variant.sh` (sandboxed `PI_CODING_AGENT_DIR` A/B; fidelity control 5,791 ≈ live 5,789). Model: Lilac/zai-org/glm-5.2, trivial prompt, sum of input+cache tokens over 1 request.

### Measured ladder

| Config | Probe | vs baseline |
|---|---:|---:|
| Live (17 pkg, 7 ext, 26 lazy skills) | **5,789** | — |
| + pi-dynamic-workflows | 6,416 | +10.8% |
| + pi-subagents | 9,599 | +65.8% |
| thinA = live − mcp-adapter − glla − delegate.ts + dyn-workflows | 5,003 | −13.6% |
| **thinB = thinA − pi-web-access (LOCKED KERNEL)** | **3,919** | **−32.3% ✓** |

Target ≤ 4,052 (30% under 5,789). thinB passes with ~130 tok headroom; ce-lite skill description adds ~70 tok → ≈ 3,990, still under.

### Locked topology (thin kernel)

- **System prompt:** lean-ctx `replace` mode compressed prompt (tool index + routing doctrine), frozen — no daily churn (repo PD findings: stable cache prefix beats prose golf).
- **Always-on tools (22):** native `edit`/`write`; lean-ctx lean profile (`ctx_shell ctx_read ctx_ls ctx_find ctx_grep ctx_edit ctx_execute ctx_execute_file ctx_batch_execute ctx_index ctx_search ctx_fetch_and_index lean_ctx ctx_stats ctx_doctor ctx_upgrade ctx_purge ctx_insight`); dyn-workflows (`workflow`, `workflow_control`).
- **Tool/skill search:** lean-ctx compressed tool surface + `ctx_search`/`ctx_index` knowledge base; skills by description index only (progressive disclosure level 1).
- **Skill descriptions always-on:** NONE visible — pi only renders `<available_skills>` when the native `read` tool exists, and lean-ctx `replace` removes it (measured in captures). Skills are read-on-demand files, not prompt content. This makes the ce-lite skill free — and requires the activation hook below.
- **Overlays:** ONE earned global overlay: `APPEND_SYSTEM.md` (pi's global append-system-prompt file, ~330 chars ≈ 85 tok): routes non-trivial work to read `skills/ce-lite/SKILL.md`; authorizes proactive `workflow` calls (dyn-workflows ships an opt-in trigger-word doctrine that would otherwise block "just knows" fanout). Project AGENTS.md discovery unchanged.
- **Post-amendment measurement (kernel sandbox, real repo settings.json + ce-lite skill + APPEND_SYSTEM.md): 3,990 tok = −31.1% ✓.**
- **Packages always-on:** pi-lean-ctx, context-mode, pi-tscg, pi-slim, pi-cache-optimizer, pi-cache-graph, pi-context-usage, cc-safety-net, pi-herdr-btw, @ogulcancelik/pi-model-agents, @ogulcancelik/pi-model-thinking, pi-continue, pi-autoresearch, @plannotator/pi-extension, @quintinshaw/pi-dynamic-workflows (all hook/command-driven = **zero schema cost**, verified in capture) — final keep/kill audit in ticket 09.

### Never always-on (measured)

- `pi-subagents` (+3,810 tok) — fails token ceiling
- super-pi (~4.1k fixed) / full CE / orchflows — destination lock
- `pi-mcp-adapter` — no MCP servers configured; dead schema (−1,125 chars cut)
- `pi-goal-list-loop-audit` — 11 goal/list/loop tools ≈ 1,100 tok; **incompatible with the 30% lock** (thinB+glla ≈ 5,020 fails). Contract/audit re-homed: ce-lite contract artifacts + dyn-workflows reviewer phase + journaled resume; loops → pi-autoresearch (0-tool). **Amends ticket 08.**
- `pi-web-access` — the painful cut. Parent web tools cost ~1,084 tok and push the kernel over budget. **Web paths that remain:** dyn-workflows child agents have built-in `web_search`/`web_fetch` (deep-research pattern covers sourced research); simple URL fetches via ctx_shell/curl; ce-lite routes lookups. Optional operator overlay documented: `pi install npm:pi-web-access` re-adds parent web at +~1,084 tok (then budget = 5,003, −13.6% — operator's explicit trade).
- `extensions/delegate.ts` — superseded per ticket 08.

### How ≥30% is hit

Cut: mcp-adapter (−1,125 chars), delegate.ts (−128), glla (−4,093), pi-web-access (−3,344). Add: dyn-workflows (+~2,400) + APPEND_SYSTEM.md (+~330). Net **−31.1% measured (3,990)**. Package cull (schema-bearing packages), NOT prompt rewriting — per PD findings.
