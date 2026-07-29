# Skill & Extension Audit — 2026-07-29 (v2, full-depth)

Method note: v1 rested on frontmatter + README heads after 24 workflow subagent calls 400'd (xhigh bug). v2: all SKILL.md bodies read directly in-session, cross-reference map built from grep. Verdicts marked REVISED where v2 changed them.

## 0. Live findings (exercising the stack)

1. **Workflow layer was 100% broken** — subagents inherit session thinking `xhigh`; Lilac vLLM rejects it. 3 runs × 8 agents = 24 silent failures. Fixed on disk (`models.json` Lilac `xhigh`/`max`→`high`, both copies). **Needs pi restart** (config cached at boot).
2. **lean-ctx ↔ context-mode coexistence is by design** (user correction): `pi-lean-ctx-config.json` = `{mode: replace, enableMcp: false}` — lean-ctx does tool-I/O compression via CLI, context-mode is the sole MCP bridge. No conflict. Wart: `ctx_edit` advertised but errors without the bridge.
3. **lean-ctx shell gating contradicts its config comment**: `~/.config/lean-ctx/config.toml` says "Disabled gating entirely" (`shell_allowlist = []`) yet inline `python3 -c`/`node -e` hard-blocked this session. Comment ≠ behavior.
4. **`rules/lean-ctx.md` is stale**: mandates ctx_compose/ctx_patch/ctx_tree/ctx_glob/ctx_callgraph/ctx_session/ctx_knowledge — none exist in the live CLI-mode surface.
5. **pi-slim enabled but inert**: the Pi-docs block it removes is still in the live system prompt.
6. **Config drift**: `~/.pi/agent/models.json` ≠ repo copy (fixed for xhigh; general drift unaddressed). No enforced single source of truth.
7. **TSCG + lean-ctx tee redaction can hide tool output from the agent** ("Mocha: 0 passed", full-output → tee log). Compression stack occasionally eats the very output requested.

## 1. Architecture verdict

There IS an architecture, two layers deep:
- **ce-lite** (via APPEND_SYSTEM.md) = operator-facing router: simple→direct, lookup→research/deep-research workflow, non-trivial→contract loop (grill→terms→plan→workflow fan-out→verify), loop-shaped→autoresearch. Delegates execution to **pi-dynamic-workflows**. References pi-continue, /btw (pi-herdr-btw), ctx_index (context-mode).
- **ask-matt** = the manual for the mattpocock skill web (the "mechanic's shelf" ce-lite names): grill-with-docs→to-spec→to-tickets→implement(tdd inside, code-review closes), wayfinder for multi-session fog, triage for external issues, handoff-vs-compact doctrine, smart-zone rule. REVISED: not redundant with ce-lite — it's reference documentation, command-gated, costs one description line.
- **plannotator** = orthogonal human-review UI. No collision.

The accretion is elsewhere: continuity (3 mechanisms), compression (4 layers), usage displays (3), and one foreign-harness port.

## 2. Redundancy matrix (v2)

| Item | Overlaps with | Severity | Resolution |
|---|---|---|---|
| handoff (skill) | pi-continue, context-mode continuity | partial | REVISED: keep all three. ask-matt doctrine: "/handoff forks (new agent, portable doc); /compact continues; pi-continue resumes this session." Distinct mechanics, command-gated. |
| grill-me | grilling | low | grill-me is a 7-line stub → "run /grilling". Already merged in effect. Optional delete. |
| grill-with-docs | grilling + domain-modeling | none | Also a stub, but it's the documented stateful entry to the matt flow (leaves CONTEXT.md/ADR trail). Keep. |
| prompt-sharpen | ce-lite contract loop | partial | Both turn vague asks into checkable briefs. prompt-sharpen is operator-invoked; ce-lite does it in-loop. Keep (harmless) or cut (unreachable under ce-lite routing). |
| full-output-enforcement | AGENTS.md Output Contract, lean-ctx compression rules | **direct contradiction** | Bans brevity; harness mandates terseness. Command-gated so inert until invoked, but it's a loaded footgun. Cut or rename clearly. |
| caveman-compress | lean-ctx/context-mode compression stack | low | Different layer (file-level, shells to Claude API). Keep as utility or cut as 4th compression mechanism. |
| system-health-check | — (foreign harness) | **broken here** | Probes ~/.omp, models.yml, RTK, ~/.mimocode, Context7 section, super-research skill (not installed). Port to pi paths or cut. |
| ponytail-audit | improve-codebase-architecture | low | Different lenses: deletion vs module-deepening. Keep both. |
| auto-session-name | auto-title | medium | Same pkg, same job. Keep auto-title, cut the other. |
| pi-cache-graph | pi-cache-optimizer | medium | Gauge vs actuator; cache-graph's companion pi-context-prune is dormant. Enable pi-context-prune or cut pi-cache-graph. |
| pi-context-usage | compact-header | medium | Keep pi-context-usage (/context details deepest), cut compact-header. |
| pi-lean-ctx | context-mode | none (verified) | Layered deliberately. Keep both. |
| research / wayfinder / autoresearch / last30days | — | none | Distinct scopes. Keep. |
| ask-matt | ce-lite | none (REVISED) | Manual vs router. Keep. |
| to-questionnaire / to-spec / no-ai-slop / impeccable / workflow-authoring / workflow-patterns | — | none | Keep. |

## 3. Final lists

**Cut (high confidence):** full-output-enforcement (contradiction), system-health-check (broken port — or port it), compact-header, auto-session-name, pi-slim (inert — fix or drop), grill-me (stub alias).
**Decide then act:** pi-cache-graph (+maybe enable pi-context-prune), prompt-sharpen, caveman-compress, pi-cache-optimizer (only if you care about KV-cache hit rate — harmless footer otherwise).
**Keep:** ce-lite, all mattpocock engineering skills, ponytail family (6), research/wayfinder/autoresearch-*/last30days, personal-domain set (invest-optimizer, calibrate-longevity, ai-consultant-career, conversion-copywriting), workflow-authoring/patterns, context-mode+ctx-*, pi-lean-ctx, pi-tscg, cc-safety-net, plannotator, pi-continue, pi-herdr-btw, model-agents, model-thinking, clipboard-image, markdown-viewer, pi-context-usage, setup-*.
**Fix:** rules/lean-ctx.md (stale tool surface), lean-ctx shell-gate comment, models.json drift (symlink repo→~/.pi or sync script), pi-slim.

## 4. Dormant weight (20 pkgs installed, not enabled)

Uninstall: pi-btw, pi-herdr, @ogulcancelik/pi-handoff, pi-goal-list-loop-audit, @narumitw/pi-goal, pi-readcache, pi-mcp-adapter, pi-shazam, @gotgenes/pi-permission-system, pi-simplify, pi-lens, pi-subagents (dynamic-workflows covers), pi-web-access, @hypabolic/pi-hypa, @leing2021/super-pi, gentle-engram, pi-hermes-memory, @ogulcancelik/pi-session-recall, pi-smart-compact.
One decision: pi-context-prune — enable (justifies cache-graph) or uninstall (then cut cache-graph too).

## 5. Cohesion tests (post-restart)

1. 1-agent workflow on `Lilac/moonshotai/kimi-k2.6` → check run JSON for clean `agents[0].history` (no 400).
2. Fresh session: does the Pi-docs block still appear in system prompt? (pi-slim test — currently failing.)
3. `/context details` renders; `/cache graph` non-flat during long session (else cache-optimizer measuring nothing).
4. `diff ~/.pi/agent/models.json ~/Projects/pi-harness-config/models.json` → empty.
5. Say "grill me about X" → grilling loads; "audit this codebase" → ponytail-audit; confirm no double-trigger with improve-codebase-architecture.

## 6. Proposed apply-order for ~/.pi (risk-ranked)

LOW: delete grill-me, full-output-enforcement, system-health-check dirs; remove compact-header + auto-session-name from settings.json extensions; uninstall dormant npm pkgs; fix rules/lean-ctx.md.
MED: pi-slim fix-or-remove; pi-cache-graph/pi-context-prune decision; symlink models.json to repo.
HIGH (touch core loop): any ce-lite/APPEND_SYSTEM.md edits — only after cohesion tests 1-4 pass.
