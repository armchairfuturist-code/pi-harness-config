# Slim harness — audit & cut list

DRAFT — for approval before any file is changed.

## The two layers (the design rule)

- **Deterministic layer (host code):** things that must never loop or drift.
  Owned by code, not by prompt text. `install.sh`, the mechanical shield,
  workflow fan-out mechanics, goal-continuation limits, session recall index,
  tool-profile watchdog.
- **Judgment layer (model + lazy reference):** when to grill, when to fan out,
  what "done" means. Owned by the model, with reference files read on demand.

Everything below is judged by: does it belong in the deterministic layer,
and does it carry its own token/maintenance cost?

---

## 1. Packages (settings.json)

| Package | What it does | Verdict |
|---|---|---|
| `context-mode` | MCP context compression | **KEEP** — the single biggest token lever. Not replaceable. |
| `pi-lean-ctx` | routes read/grep/find/ls through lean-ctx | **KEEP** — pairs with context-mode. |
| `pi-tscg` | tool-schema/result compression | **KEEP** — HIL-locked, measured −1.2%. |
| `pi-slim` | system-prompt slimming | **KEEP** — token lever, no loop surface. |
| `@quintinshaw/pi-dynamic-workflows` | fan-out engine (`workflow()`/`agent()`) | **KEEP** — the actual fan-out substrate. This is what CE-lite's doctrine keeps pointing at. |
| `@ogulcancelik/pi-model-thinking` | auto thinking-level mapping | **KEEP** — passive, zero loop surface. |
| `@samfp/pi-essentials` | session naming, compact header, clipboard, markdown | **KEEP (trim?)** — mostly passive UX. No loop surface; not the problem. |
| `@howaboua/pi-smart-btw` | `/btw` async side questions | **KEEP** — useful, isolated, not a loop source. |
| `@howaboua/pi-skill-model-facing-api-design` | one API-design skill | **REVIEW** — niche; drop unless used. |
| `ponytail` (git) | ponytail mode | **KEEP** — operator choice, not agent-facing. |

**Cut candidates:** only `pi-skill-model-facing-api-design` (niche skill). The
rest are the deterministic/token layer and should stay.

## 2. Extensions (settings.json)

| Extension | What it owns | Verdict |
|---|---|---|
| `transcript-pruner.ts` (+`lib/prune-core.mjs`) | pointer-replaces spent tool results (DEDUP/STALE/CLEAR) | **KEEP** — deterministic token lever, HIL-adjacent. |
| `session-index.ts` | zero-token session summaries for recall | **KEEP** — this is the "wayfinding memory" done deterministically. |
| `runtime-discipline.ts` | failure-only recovery nudges (allowlist/edit/retry) | **KEEP** — the retry-loop breaker is *the* anti-loop mechanism. |
| `rot-sentinel.ts` | context-rot detection → handoff marker | **KEEP, default-off** — already off by default (`PI_ROT_ENABLED=1`). |
| `enforce-tool-profile.ts` | pins lean tool profile at launch | **KEEP** — deterministic watchdog. |
| `ce-lite-shield.ts` + `ce-lite-auditor.mjs` | mechanical check gate (writes/tests → terms, red/green, refuses forged Done) | **KEEP — this is the 15% worth keeping.** |
| `ce-lite-preload.ts` | injects ~450-token routing doctrine per session | **DROP.** The judgment layer as per-turn prompt injection. Failed the recon-loop case. |

## 3. ce-lite skill tree (bundled-skills/ce-lite/)

| File | Content | Verdict |
|---|---|---|
| `SKILL.md` (56 ln) | route + contract loop + footer | **GUT to ~20 lines.** Keep only: shield is automatic, don't call ce_* tools, statusline is the score, host does proof/compact/handoff. |
| `grilling.md` (56 ln) | one-question-at-a-time grilling | **KEEP as lazy reference** — mattpocock-derived, genuinely useful when a task is fuzzy. |
| `wayfinding.md` (78 ln) | multi-session ticket map | **KEEP as lazy reference** — mattpocock-derived. |
| `gather-judge.md` (24 ln) | judgment-over-evidence | **KEEP** — small. |
| `context-health.md` (32 ln) | HANDOFF schema | **KEEP** — pairs with session-index/rot-sentinel. |
| `reference.md` (97 ln) | recall/decomposition/worker contract | **KEEP, trimmed** — worker result contract is needed by dynamic-workflows. |

The mattpocock-derived files are exactly what the user named as desired; they
should stay as **on-demand reference**, not be injected every session.

## 4. Bundled skills (other)

| Skill | Verdict |
|---|---|
| `smart-read` | **KEEP** — read-tool discipline, pairs with APPEND_SYSTEM.md. |
| `harness-doctor` | **KEEP** — the apply/verify command. |
| `context-rot-forensics` | **KEEP** — post-hoc analysis, lazy. |
| `shard-security` | **KEEP** — small, optional. |
| `graph-engineering` | **KEEP** — optional, lazy; supports dynamic-workflows. |

## 5. Patches

| Patch | Verdict |
|---|---|
| `context-mode/` (admin tools off) | **KEEP** — measured −6.5%. |
| `tscg/` (recursive truncation) | **KEEP** — HIL-locked. |
| `dynamic-workflows/` (workflow-tool schema slim) | **KEEP** — measured token save. |

## 6. Scripts (repo-owned)

All KEEP — `install.sh`, `harness-doctor.sh`, `harness-preflight.sh`,
`capture-live-tweak.sh`, `sync-live.sh`, validators. These are the
deterministic apply/verify pipeline.

---

## The slimmed design (net change)

**Remove:**
1. `extensions/ce-lite-preload.ts` — delete (and its manifest/settings entry, HARNESS.md reference, HIL note).
2. `@howaboua/pi-skill-model-facing-api-design` — drop from settings + lock.

**Gut (keep file, shrink content):**
3. `bundled-skills/ce-lite/SKILL.md` → ~20 lines. Shield mechanics + "host does proof/compact/handoff" only. Remove route table, contract-loop prose, execute-discipline (that becomes a smart-read/reference note instead of per-session doctrine).

**Keep unchanged:** shield + auditor + tests, transcript-pruner, session-index,
runtime-discipline, rot-sentinel, enforce-tool-profile, all other skills,
patches, scripts, packages.

**Resulting loop-defense stack:**
- retry-loop breaker + failure-only nudges (runtime-discipline) — stops the identical-failure loop
- mechanical shield (ce-lite-shield) — gates "done" on checkable evidence
- noProgressTurns=3 + automaticTurns=25 (pi-goal limits) — bounds any still-running loop
- recon-bound as a *reference note* (smart-read), not per-turn doctrine

That is: pi-dynamic-workflows (fan-out) + pi-goal limits (loop cap) + a slim
shield (proof) + mattpocock reference files (judgment, on demand). The CE-lite
wrapper's injection layer is the cut.

---

## What I will NOT touch without separate sign-off

- `hil/HANDOFF.md` / `ledger.md` — HIL is paused; these changes are capability
  cuts, which HANDOFF says are allowed, but I will not rewrite the ledger.
- KEEP / tscg / maxDescChars — locked.
- Anything under `bench/` or `observability/`.
