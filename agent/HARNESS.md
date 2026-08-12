# HARNESS — runtime policy (source of truth)

This file is the operator-facing contract for the deployed pi agent home.
HIL changes go through `hil/HANDOFF.md` + `hil/ledger.md`. Do not freestyle
KEEP / compaction / tscg knobs.

## Goals
- Cheaper turns (stable KV-cache prefix, lean tools, measured pruning)
- Smarter routing (ce-lite for multi-step work; skip for lookups)
- Measurement-gated changes only

## Locked posture (see HANDOFF)
- KEEP=4, reserveTokens=24000, keepRecentTokens=20000
- tscg strip on, maxDescChars=20 KEEP
- HIL paused for knob churn; capability/measurement work still OK

## Extensions (order matters for before_agent_start merges)
1. `runtime-discipline.ts` — allowlist/edit recovery (may append system guidance on failure only)
2. `ce-lite-preload.ts` — **H4-safe**: injects ce-lite contract as a *custom message* (LLM user role) once per session on non-trivial prompts; never mutates systemPrompt
3. `session-index.ts` — session FTS index
4. `rot-sentinel.ts` — long-session UI reminders (not system-prompt mutation)
5. `transcript-pruner.ts` — transcript hygiene

## Cache doctrine (progressive-disclosure H4)
- Keep the **stable system prefix** byte-stable across turns
- Do not prune or rewrite system prompt mid-session to "save" tokens — it kills cacheRead
- Event-specific guidance → custom messages, UI notifications, or failure-only appends
- Measure: `bench/probe.sh` emits `cache_hit_pct` = cacheRead/(cacheRead+input)

## CE-lite activation
- `APPEND_SYSTEM.md` — imperative one-liner (when to load)
- `extensions/ce-lite-preload.ts` — mechanical preload of skill body on heuristic match
- Kill switch: `CE_LITE_PRELOAD=0` · force: `CE_LITE_PRELOAD=force`
- Trivial chat/lookups must still skip (suite s6)

## Output style (default)
- `APPEND_SYSTEM.md` — compact always-on output contract: answer-first, short by default,
  STE100-controlled English, deliverables unwrapped, warnings never trimmed
- Carve-out: explicitly requested writing content (emails, docs, copy) runs full length —
  substance is never truncated; only wrapper text stays off
- Token posture: small fixed prefix delta per turn (probed), offset by leaner replies

## Measurement
- `bench/probe.sh` — tokens + cache hit rate
- `bench/semantic-canary.sh` — skill semantics + preload H4/heuristics + optional session efficiency
- `bench/test-ce-lite-preload.mjs` — unit heuristics
- `bundled-skills/harness-doctor/scripts/trajectory_metrics.py` — per-session tool/error metrics

## Install
```bash
./install.sh
# or INSTALL_TARGET=~/.pi/agent ./install.sh
```
