# Wayfinder map: Thin Pi harness (CE-lite)

Labels: `wayfinder:map`

## Destination

Produce a **thin-harness architecture decision + full operator pack** for **Pi only** (`~/.pi/agent` + this repo), for a **non-developer, contract-only** operator.

The harness runs a **single CE-lite orchestrator** (Claude-like “just knows”): simple queries skip ceremony; non-trivial work runs **grill-when-needed → plan → execute under contract → review/audit → compound** without the human memorizing gates or skill names. Always-on fixed overhead must be **≥30% under measured live baseline**. Multi-agent is required under a **capability bar + token ceiling** (herdr and/or automatic subagents). Domain skills are an **optional library**; engineering/matt skills are **mechanism donors**, not the operator surface. Default skill load is **lazy/near-zero always-on**.

Spec must include: topology + budget target; stage→owner map; subagent/herdr decision; keep·kill·disclose lists; model-role hypothesis validated vs best practice; lightweight **upstream CE radar**; concrete token + usability canaries; handoff to apply via `/to-spec` or one `/goal`.

**Not this map:** applying the live config, multi-harness work, bulk-installing CE/orchflows/super-pi, or building CE auto-sync bots.

## Notes

- **Domain:** Pi harness engineering; token efficiency; AFK orchestration for non-dev operator
- **Skills to consult:** `/wayfinder`, `/research`, `/grilling`, `/domain-modeling`, `/writing-great-skills` (when culling skills)
- **Evidence weight:** newer files + current `pi-harness-config` (incl. GitHub baseline) beat older historical optimization notes; still grep the full corpus
- **External mechanism donors (not bulk installs):** Compound Engineering, super-pi, orchflows, `@quintinshaw/pi-dynamic-workflows`
- **Anti-over-engineering:** default delete; every always-on token must earn keep; assess tools first; fork/autoresearch only after apply path is clear
- **Model posture (hypothesis to validate):** mid–high tier for default exec; cheaper for simple exec + audit; expensive for deep research/reasoning
- **Tracker:** local markdown — see `docs/agents/issue-tracker.md`

## Decisions so far

- [01 — Inventory local corpus](issues/01-inventory-local-corpus.md) — Live=17 pkg/7 ext/26 skills; session freqs; probe method; candidates only. → `research/wayfinder/01-inventory-local-corpus.md`
- [02 — Minimal harness & context engineering](issues/02-research-minimal-harness-context-eng.md) — Progressive disclosure + stable cache prefix; cut schema/skills not churn prompts. → `research/wayfinder/02-minimal-harness-context-engineering.md`
- [03 — Compound Engineering mechanisms](issues/03-research-compound-engineering.md) — Steal loop/orchestrator-skill/compound; radar seeds; no bulk CE. → `research/wayfinder/03-compound-engineering-mechanisms.md`
- [04 — Orchestration primitives comparison](issues/04-research-orch-superpi-dynworkflows.md) — dyn-workflows best Pi “just knows”; super-pi/orchflows mechanism donors. → `research/wayfinder/04-orchestration-primitives-comparison.md`
- [05 — Pi multi-agent stack](issues/05-research-pi-multiagent-stack.md) — delegate fails bar; shortlist dyn-workflows or pi-subagents + herdr-btw. → `research/wayfinder/05-pi-multiagent-stack.md`
- [06 — Model routing practice](issues/06-research-model-routing-practice.md) — Roles>IDs; reviewer≠cheapest; need per-child models. → `research/wayfinder/06-model-routing-practice.md`
- [08 — Grill: lock CE-lite orchestrator](issues/08-grill-ce-lite-orchestrator.md) — Composition: ce-lite meta-skill entry + dyn-workflows fanout (+627 tok, probed) + herdr-btw; pi-subagents rejected (+3,810); delegate.ts killed. glla internalization revised by 07.
- [07 — Grill: lock always-on topology](issues/07-grill-always-on-topology.md) — Kernel locked at **3,919 tok = −32.3%** vs live 5,789 (probe-measured): lean-ctx lean profile + dyn-workflows; kills mcp-adapter, glla, pi-web-access, delegate.ts; 22 always-on tools; skill descriptions ≈ 0.
- [11 — Grill: CE upstream radar](issues/11-grill-ce-upstream-radar.md) — `research/ce-upstream-radar.md`: monthly doc-only diff; adopt only with neutral/negative probe delta; CE adapted, super-pi install rejected.
- [10 — Grill: model roles](issues/10-grill-model-roles.md) — Roles locked (router/worker/leaf/reviewer/auditor/reasoner); pin in one `model-tiers.json`; reviewer≠cheapest confirmed; reasoner extends to hard planning.
- [09 — Grill: keep/kill/disclose](issues/09-grill-keep-kill-disclose.md) — Kill: mcp-adapter, glla, pi-web-access, delegate.ts, pi-subagents. Keep: 15 zero-schema pkgs + lean-ctx/context-mode/dyn-workflows + 6 essentials exts + 26 lazy matt skills. Domain library off.
- [12 — Grill: canaries](issues/12-grill-canaries.md) — Token: probe ≤4,052 vs 5,789 baseline + measure.sh green. Usability U1–U5 fixed prompts: simple Q, lookup, grilled work, contract exec, review — no manual gates.
- [13 — Grill: operator pack & handoff](issues/13-grill-operator-pack-handoff.md) — Pack at `.scratch/thin-pi-harness/spec.md`; apply = one goal gated on canaries; live sync only with operator OK. **Map closed.**


## Not yet specified

- (post-apply, beyond this map) Optional autoresearch campaign to thin forked tool schemas further
- (post-apply) Domain-library uptake is decided per project, not here

## Out of scope

- Applying/thinning the live `~/.pi/agent` config (handoff after map)
- OMP, OpenCode, or other non-Pi harnesses
- Bulk install of full Compound Engineering / orchflows / super-pi as the runtime
- Automated upstream-CE sync bot (radar doc only for v1)
- Redesigning unrelated product codebases

## Frontier (after AFK wave)

**Resolved:** 01–06 (see Decisions so far).

**MAP CLOSED 2026-07-27** — all 13 tickets resolved AFK under handoff contract (user delegated the whole map; pre-locked charting decisions + probe measurements stood in for live grilling). Operator pack: `.scratch/thin-pi-harness/spec.md`. Baseline probe: **5,789**; locked kernel: **3,919** (−32.3%). Next: apply per spec §8 (one goal), verify canaries, push.
