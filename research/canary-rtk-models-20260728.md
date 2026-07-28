# Canary fix + rtk.ts resolution + models.json sync — 2026-07-28

Follow-up operator actions from `autoresearch-config-overhead-20260728/findings.md`.
Three loops closed; all measured through the capture proxy (cold-gated, full-cost).

## 1. Canary fixed — `bench/probe.sh` now trustworthy

**Problem:** the old `bench/probe.sh` ran `pi -p` directly against the live agent
dir. Provider-side prompt caching made it false-green: an identical payload
returned **2,356 tok** warm vs **4,014 tok** cold (2026-07-28). Regressions hid.

**Fix:** rewrote `bench/probe.sh` to (a) ensure the bench-systima capture proxy
(`bench/proxy.sh`, promoted from the archived session), (b) build a variant agent
dir from the **committed repo tree** (`bench/build-variant.sh`, promoted), (c)
route the trivial prompt through the proxy. Output format preserved
(`PROBE total=<tok> requests=<n>`).

**Verified:** proxied probe = **4,005 tok** (deterministic; research baseline
4,007, ±2 within stated determinism). The old direct probe would have reported
~2,356 on the same payload. Canary now catches regressions.

**Note:** `bench/proxy.sh ensure` is idempotent; call `bench/proxy.sh stop` to
tear down at session end. Proxy listens on 127.0.0.1:4599 → api.getlilac.com.

## 2. rtk.ts measured INERT → dropped from live

**rtk.ts** was a live-only loose extension (`~/.pi/agent/extensions/rtk.ts`,
not in `settings.json` extensions array) that rewrites `bash` commands to `rtk`
equivalents for output-token savings. Unmeasured in the config-overhead session.

**Fixed-overhead probe** (with rtk vs `NO_RTK=1`): both **4,005 tok, Δ=0**.
Expected — it's a `tool_call` lifecycle hook with no tool schema.

**Workload bench** (with rtk, 2 reps): 12,484 / 17,147. Tool-call inspection of
the session: `ctx_shell` ×2, `ctx_read` ×2, `write` ×1, **`bash` ×0**,
**`rtk` occurrences = 0**. Sample commands (`ls -la`, `find`) ran via `ctx_shell`
unrewritten.

**Root cause:** rtk.ts hooks `isToolCallEventType("bash", event)`, but
context-mode `replace` mode removes the `bash` tool entirely — the harness routes
shell through `ctx_shell`. rtk.ts can never fire. rtk 0.44.0 is installed and
the extension loads, but it has no target.

**Resolution:** dropped from live (`rm ~/.pi/agent/extensions/rtk.ts`); copy
preserved in `extensions-disabled/rtk.ts` for reversibility. `build-variant.sh`
rtk-symlink block removed. Drift closed. (To reactivate: restore the file AND
either disable context-mode or patch rtk.ts to hook `ctx_shell` — but ctx_shell
output is already lean-ctx-compressed, so double-processing is likely not worth
it.)

## 3. models.json synced — repo ← live

**Drift:** repo `models.json` = 2,176 B (Lilac only, 4 models); live = 7,556 B
(Venice 19 models + Lilac 4). Invisible to the probe (models.json defines
providers, injects no tool schemas or system prompt) — purely a reinstall hazard.

**Fix:** `jq . ~/.pi/agent/models.json > models.json`. Repo now reproduces the
live provider set (apiKey refs are env vars, no secrets). `build-variant.sh`
patches live models.json for the proxy path, so this file is a faithful
reinstall reference, not a rig input.

## Outcome

| Loop | Action | Token impact |
|---|---|---|
| Canary | proxy-routed + variant-based `probe.sh` | measurement-only; 4,005 verified |
| rtk.ts | dropped from live (inert), copy in repo | 0 (was 0, now confirmed) |
| models.json | repo ← live sync | 0 (invisible to probe) |

Kernel remains at ~4,005–4,007 tok. No frontier lever was config-testable
(Tool Attention / response-filtering / semantic cache all need a new package —
logged as build-only watch in `ce-upstream-radar.md`).
