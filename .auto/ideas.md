# Ideas — Config Fixed-Overhead

## Cheap first pass: per-component cost attribution (do this FIRST)

One-at-a-time removal probes to build the cost table for What's Been Tried.
Each is one edit + one probe + one checks run. Keep only if removal is free
(checks pass) AND the component plausibly earns its tokens back in workflows —
if unsure, record the cost in the table and restore, flag for operator decision.

Packages (15): `@ogulcancelik/pi-model-agents`, `@ogulcancelik/pi-model-thinking`,
`@plannotator/pi-extension`, `cc-safety-net`, `context-mode`, `pi-autoresearch`,
`pi-cache-graph`, `pi-cache-optimizer`, `pi-context-usage`, `pi-continue`,
`pi-herdr-btw`, `pi-lean-ctx`, `pi-slim`, `pi-tscg`, `@quintinshaw/pi-dynamic-workflows`.
(pi-tscg removal is a probe ONLY to quantify its savings — it is off-limits for
actual removal; restore immediately after measuring.)

Extensions (6 pi-essentials): `auto-session-name`, `auto-title`, `clipboard-image`,
`compact-header`, `image-context-pruner`, `markdown-viewer`. Plus live-only
`rtk.ts` (drift item — measure it, then decide: adopt into repo or drop live).

## Structural avenues

- **APPEND_SYSTEM.md tightening**: ~103 tok (est.) → target ≤70 without losing routing
  doctrine (the workflow-proactively sentence is the longest; can it be shorter
  without changing behavior? checks.sh won't catch doctrine loss — judge by diff,
  keep semantics identical).
- **Duplicate schema sources**: context-mode ships ctx-* tools AND pi-lean-ctx
  bridges lean-ctx. Probe whether lean-ctx config can drop tools already covered
  elsewhere (read both configs before touching).
- **Skill-metadata tax**: measure whether skills/ contents affect probe_total at
  all (empty skills dir probe, then restore). If zero, skills are fully lazy and
  skill trimming is out of scope forever — record that, stop considering it.
- **`defaultThinkingLevel`**: medium is the repo default. Probe minimal/low ONLY
  to quantify; thinking level is a quality lever, not overhead fat — likely restore.
- **`pi-slim` / `pi-cache-*` interactions**: these modify caching behavior.
  Through the proxy, inspect `~/bench-systima/captures/autoresearch/` payloads
  to see exactly what each adds to the tools array / system prompt — far more
  informative than token sums alone.

## Validation lane (for kept changes, before finalize)

- `cd ~/bench-systima && bash rig/run-pi-ab.sh` — A/B the kept config vs live
  through the capture proxy for a real-workload confirmation.
- After operator applies to live: `./bench/probe.sh` canary (must print ≤ kept
  value) and `./bench/measure.sh 3` (all `checks_pass=1`).

## Upstream bugs found during session setup (report, don't fix locally)

- **pi-lean-ctx #930 half-fix**: `PI_CODING_AGENT_DIR` set ⇒ config path gets a
  doubled `agent/` segment (`.../agent/agent/extensions/...`), bridge silently
  boots on defaults. +~14.7k tok phantom in any relocated agent dir.
- **`bench/probe.sh` canary is cache-contaminated**: direct Lilac probes
  undercount warm prefixes (2,356 observed on a 4,014-tok payload). The README
  verify gate (`probe.sh` ≤ 4052) can false-green a regression. Consider
  routing probe.sh through the capture proxy too, or documenting "cold only".

## Deferred / known out-of-scope

- `compaction.reserveTokens/keepRecentTokens` — invisible to the 1-request probe;
  needs a long-session bench (bench/measure-long.sh) — separate session.
- bench-systima cross-harness comparison (omp/opencode) — not this session's question.
- opencode2 non-interactive model bug — tracked upstream in wayfinder notes.
