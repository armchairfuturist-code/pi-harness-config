# CE-lite Thin Pi Harness — Operator Pack (spec v1)

**Status:** locked by wayfinder map `.scratch/thin-pi-harness/map.md` (tickets 01–12), 2026-07-27.
**Audience:** non-developer, contract-only operator. **Harness:** Pi only.
**North star:** Claude-like "just knows" — one orchestrator, zero gates to memorize, measured token thinness.

---

## 1. Topology + budget

| | |
|---|---|
| Always-on probe (final kernel, sandbox-measured, incl. APPEND_SYSTEM.md) | **4,014 tok** |
| Live baseline (2026-07-27, `bench/probe.sh`) | 5,789 tok |
| Budget lock | ≥30% under baseline ⇒ ≤ 4,052 ✓ (−30.6%) |
| Workload (measure.sh vs measure-variant.sh, 1 run each) | live 18,403 → kernel 12,449 tok (−32.4%), both checks_pass=1 |
| bench-systima A/B (rig/run-pi-ab.sh, files.txt task) | pi-old 5,780 → pi-new 3,979 first-request input (−31.2%); 4 → 2 requests |
| Always-on tools | 22 (native edit/write, 18 lean-ctx lean-profile, 2 dyn-workflows) |
| Always-on skill descriptions | none visible — lean-ctx replace drops native `read`, so pi omits `<available_skills>` entirely (measured) |
| Orchestrator activation | `APPEND_SYSTEM.md` global append file (~85 tok): routes non-trivial work to read `skills/ce-lite/SKILL.md`; authorizes proactive `workflow` calls |
| System prompt | lean-ctx `replace` mode compressed; frozen (stable cache prefix) |

Token doctrine (from ticket 02): cut schemas/packages, never churn the cached system prefix. Every always-on token earns its keep or is deleted.

**pi-tscg is load-bearing (measured 2026-07-27):** the `aggressive` profile (30-char description truncation, live `~/.pi/tscg.json`) compresses the kernel's tool schemas by ~6k tokens — switching to `balanced` inflates the kernel probe from 4,014 to 9,994. Do NOT retune tscg; side effect (truncated tool docs, incl. the workflow tool's pattern list) is compensated by the APPEND_SYSTEM.md guidance, verified in canary U6.

## 2. The single orchestrator: `ce-lite`

One model-invocable skill is the whole operator surface. Routing doctrine:

1. **Simple** (fact Q, one-liner, chat) → answer directly. No ceremony.
2. **Lookup** (web-shaped) → route to research path (workflow child with web tools or direct fetch).
3. **Non-trivial** → grill ONLY blocking questions (one at a time) → write contract terms (acceptance criteria as an artifact) → plan summary → execute, fanning out via **pi-dynamic-workflows** (`agent()`/`parallel()`/`phase()`, tiers small/medium/big, journaled resume) → **reviewer phase** verifies deliverable against contract terms → deliver + **compound** (save reusable pattern/note to the knowledge store).
4. **Loop-shaped** (optimize X over iterations) → pi-autoresearch campaign.
5. Operator side questions anytime → `/btw` (pi-herdr-btw), never pollutes the main transcript.

Matt skills (implement/tdd/research/diagnosing-bugs/code-review/…) are **lazy backends** the orchestrator reads when relevant (`disable-model-invocation`, measured 0 always-on). The operator never types a skill name.

### Stage → owner map

| Stage | Owner | Operator sees |
|---|---|---|
| Simple Q&A | parent model | just the answer |
| Triage/route | ce-lite (parent) | nothing |
| Grill | parent, blocking Qs only | one short question at a time |
| Contract | ce-lite writes terms artifact | terms up front |
| Plan | parent (big tier if hard) | short summary |
| Execute | dyn-workflows fanout (leaf/worker tiers) | progress panel |
| Review/audit | dyn-workflows reviewer phase (medium tier) | findings summary |
| Compound | pattern/note to knowledge store | one line |
| Side thread | pi-herdr-btw | operator-initiated pane |

### `ce-lite` SKILL.md + APPEND_SYSTEM.md (apply-time artifacts)

Locations: `skills/ce-lite/SKILL.md` (repo → `~/.pi/agent/skills/ce-lite/`) and `APPEND_SYSTEM.md` (repo → `~/.pi/agent/APPEND_SYSTEM.md`).
**Mechanism (measured):** pi's `<available_skills>` block only renders when the native `read` tool exists; lean-ctx `replace` removes it, so skill descriptions are invisible to the model regardless of frontmatter. The orchestrator therefore activates via the global append file (pi discovers `<agentDir>/APPEND_SYSTEM.md`): a ~330-char block telling the parent to answer simple questions directly, read the ce-lite skill for non-trivial work, and call `workflow` proactively (overriding dyn-workflows' opt-in trigger-word doctrine, which the skill body also overrides inside the contract loop).
Skill body ≤ 60 lines: routing doctrine, contract loop (grill → terms → plan → dyn-workflow exec → verify vs terms → deliver + compound), operator-never-types-rules. References (lazy): matt skills by name; workflow-authoring/workflow-patterns for fanout syntax.

## 3. Subagent / herdr decision (locked 08, measured)

- **Fanout engine:** `@quintinshaw/pi-dynamic-workflows` (+627 tok; tiers; resume; 5 built-in patterns: deep-research, adversarial-review, code-review, multi-perspective, codebase-audit).
- **Rejected:** pi-subagents (+3,810 tok), super-pi (~4.1k fixed), delegate.ts alone (fails capability bar), full CE/orchflows (destination lock).
- **Human side thread:** pi-herdr-btw.
- **Kill:** `extensions/delegate.ts`.

## 4. Keep · kill · disclose (locked 09)

- **Kill packages:** pi-mcp-adapter (no servers), pi-goal-list-loop-audit (1,100 tok, vs budget), pi-web-access (1,084 tok; web → workflow children; optional overlay documented).
- **Keep packages:** pi-lean-ctx, context-mode, @quintinshaw/pi-dynamic-workflows, pi-tscg, pi-slim, pi-cache-optimizer, pi-cache-graph, pi-context-usage, pi-continue, pi-autoresearch, @plannotator/pi-extension, @ogulcancelik/pi-model-agents, @ogulcancelik/pi-model-thinking, cc-safety-net, pi-herdr-btw.
- **Keep extensions:** 6× @samfp/pi-essentials (UI, zero schema).
- **Skills:** 26 matt skills stay lazy; domain library separate/default-off; only ce-lite model-invocable.
- **Rules/overlays:** ONE global overlay earned: `APPEND_SYSTEM.md` (~85 tok, the ce-lite activation hook). No other global rules; project AGENTS.md discovery unchanged.

## 5. Model roles (locked 10)

Roles pin in **one file** `~/.pi/workflows/model-tiers.json` (small/medium/big); parent = settings.json defaultModel. No IDs in prose. Auto-derive on apply → observe 1 week → pin explicitly → re-benchmark quarterly.

| Role | Tier | Slot |
|------|------|------|
| router/parent | mid–high | default model |
| worker | mid–high | medium |
| leaf | cheap | small |
| reviewer | mid (not cheapest) | medium |
| auditor | cheap→mid | small→medium |
| reasoner | expensive | big |

## 6. CE upstream radar (locked 11)

`research/ce-upstream-radar.md` — doc only; monthly diff or on friction; adopt/adapt/ignore criteria tied to probe delta vs the 3,919 kernel.

## 7. Canaries (locked 12)

**Token:** `bash bench/probe.sh` ≤ 4,052 (baseline 5,789 recorded) — **as-run: 4,014 ✓**. Secondary: workload checks green — **as-run: 12,449 vs 18,403 live (−32.4%) ✓**.
**Usability (U1–U6, verbatim prompts + as-run results in ticket 12):** simple Q · simple lookup · grilled non-trivial work (interactive) · multi-deliverable contract exec · review · fanout capability. Pass = operator typed only natural language. **As-run: all green** (U3 deferred to interactive).
**Gate:** both green before apply is declared done — MET for repo apply. U2 pain → documented remedy = pi-web-access overlay (operator decision).

## 8. Apply plan (handoff: one goal)

1. Repo `settings.json`: remove pi-mcp-adapter, pi-goal-list-loop-audit, pi-web-access; add npm:@quintinshaw/pi-dynamic-workflows; remove delegate.ts from extensions. ✅ done
2. Repo: delete `extensions/delegate.ts` ✅; add `skills/ce-lite/SKILL.md` ✅; `APPEND_SYSTEM.md` ✅; commit `bench/probe-variant.sh` ✅.
3. README/WORKFLOW: rewrite operator-facing docs around ce-lite (no skill checklists).
4. Verify: probe canary (**3,990 ✓ measured in kernel sandbox**) + workload run + bench-systima old-vs-new + U1–U5 smoke.
5. Push to origin master.
6. **Live `~/.pi/agent` sync: only with explicit operator OK** (diff is: 3 packages out, 1 in, delegate out, ce-lite skill + APPEND_SYSTEM.md in, model-tiers.json auto-derives on first workflow run). Additive-only exception already taken: `skills/ce-lite/` copied into live skills so smoke tests exercise the production path — no existing live file modified.
