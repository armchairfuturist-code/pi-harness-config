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
1. `runtime-discipline.ts` — allowlist/edit recovery (failure-only system append)
2. `ce-lite-shield.ts` — automatic mechanical shield (watches writes/tests, audits on settle)
3. `session-index.ts` — session FTS index
4. `rot-sentinel.ts` — long-session UI reminders
5. `transcript-pruner.ts` — transcript hygiene
6. `enforce-tool-profile.ts` — pins lean-ctx `lean` profile at launch

## Cache doctrine (progressive-disclosure H4)
- Keep the **stable system prefix** byte-stable across turns
- Do not prune or rewrite system prompt mid-session to "save" tokens — it kills cacheRead
- Event-specific guidance → custom messages, UI notifications, or failure-only appends
- Measure: `bench/probe.sh` emits `cache_hit_pct` = cacheRead/(cacheRead+input)

## Tool execution
Always-on read/shell/output shapes live in `APPEND_SYSTEM.md` (single source). `runtime-discipline.ts` recovers after a failure only.

## CE-lite activation
- `APPEND_SYSTEM.md` — always-on pointer (when to load)
- `extensions/ce-lite-shield.ts` + `ce-lite-auditor.mjs` — automatic mechanical shield (watches writes/tests, audits on settle, forged verdict rejected)
- Trivial chat/lookups must still skip (suite s6)

## Output style
Always-on contract is `APPEND_SYSTEM.md`. Asked-for writing (email, docs, copy) stays full length.

## Measurement
- `bench/probe.sh` — tokens + cache hit rate
- `bench/semantic-canary.sh` — skill semantics + optional session efficiency
- `extensions/test-ce-lite-shield.mjs` — mechanical shield (forged green cannot close)
- `bundled-skills/harness-doctor/scripts/trajectory_metrics.py` — per-session tool/error metrics

## Install
```bash
./install.sh
# or INSTALL_TARGET=~/.pi/agent ./install.sh
```
