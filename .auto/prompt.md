# Autoresearch: Pi Harness Config — Fixed-Overhead Reduction

## Objective

Reduce the **per-request fixed overhead** (system prompt + tool schemas + always-on
extensions text) of the Pi coding-agent configuration defined by this repo. The repo
is the source of truth for the operator's live `~/.pi/agent` setup (CE-lite thin
kernel). Every experiment edits **repo files only**; a variant agent dir is
materialized from the working tree at `/tmp/pi-cfg-variant/` and benchmarked.
**Live `~/.pi/**` is never touched.**

Context: the kernel was already cut 5,789 → 4,012 tok (−30.7%, commits `c9cd69f`,
`bbfc092`). This session is polish-and-verify on an already-lean config: find
remaining fat, quantify what each package/extension costs, and confirm or refute
that ~4,016 is a local optimum. Expect marginal absolute wins — a negative result
("nothing more to cut safely") is a valid, valuable outcome.

**Session baseline: `probe_total = 4,016`** (2026-07-28, proxied, checks green).
Live parity verified the same day via proxy: 4,014 (Δ = 2-char probe cwd line).

## Metrics

- **Primary**: `probe_total` (tokens, **lower is better**) — sum of
  `input + cacheRead + cacheWrite` for one trivial request against the variant.
  Baseline: see What's Been Tried. Live-config reference: **4,012 tok** (2026-07-27).
- **Secondary** (monitors, rarely affect keep/discard):
  - `probe_requests` — must be 1; >1 means an extension is spawning extra turns.
  - `append_tokens` — chars/4 of `APPEND_SYSTEM.md`; guards overlay bloat.
  - `package_count` / `extension_count` — structural record of what was tried.

## How to Run

- `./.auto/measure.sh` — ensures proxy, builds variant, runs probe, emits
  `METRIC` lines. Fails fast (<1s) on broken JSON/missing files; the probe
  itself is 1 LLM request.
- `./.auto/checks.sh` — workload correctness bench (1 run, behavioral
  verifiers: file creation, file read, tool usage, no crash markers).
  Runs automatically after each passing benchmark. `checks_failed` ⇒ cannot keep.
- **Measurement architecture (HARD RULE): all variant traffic goes through the
  local capture proxy** (`bench-systima/rig/proxy-oi.mjs`, port 4599, managed by
  `.auto/proxy.sh`; the variant's `models.json` is a jq-patched copy pointing at
  it). **Never measure against direct Lilac** — provider-side prompt caching
  makes raw usage undercount warm prefixes (2,356 vs 4,014 on byte-identical
  payloads). Captures land in `~/bench-systima/captures/autoresearch/` — inspect
  them to see exactly what a config change added/removed from the payload.
- Cleanup: `.auto/proxy.sh stop` at finalize (it is otherwise left running;
  harmless, localhost-only, intercepts nothing else).
- `init_experiment`: name `config-overhead`, metric `probe_total`, unit `tokens`,
  direction **lower**. Model is fixed (`Lilac/zai-org/glm-5.2` via `PROBE_MODEL`
  default) — do not change it, comparability depends on it.
- Proxied numbers are deterministic modulo 1–2 tokens (cwd line). Marginal
  results (<5 tok): re-run `measure.sh` once before deciding.

## Files in Scope (the loop MAY edit these in the repo)

- `settings.json` �� package list (15 pkgs), extension list (6 pi-essentials),
  `defaultThinkingLevel`, `compaction`. (Note: `compaction` has zero effect on
  the probe — no compaction in 1 request. Don't tune it against this metric.)
- `APPEND_SYSTEM.md` — the CE-lite global overlay (~85 tok), the only global
  system-prompt addition.
- `lean-ctx/pi-config.json`, `lean-ctx/config.toml` — lean-ctx bridge knobs.
- `skills/ce-lite/SKILL.md` — only worth editing if you can show its bytes enter
  the always-on prompt (verify via the probe, don't assume).
- `README.md` — **required sync**: any kept package/extension add/remove must
  update the install list in the same commit.
- `.auto/prompt.md` (What's Been Tried), `.auto/ideas.md` — session bookkeeping.

## Off Limits (HARD — anti-cheat / anti-breakage)

- **`tscg.json`** — aggressive schema compression, explicitly load-bearing
  (README: "do not retune"). Touching it invalidates the tuning it encodes.
- `models.json`, `auth.json`, `~/.pi/**` — live config + secrets. Variant uses
  symlinks; never copy secrets into the repo, never run against live.
- `bench/*` and `.auto/measure.sh`, `.auto/checks.sh`, `.auto/build-variant.sh`,
  `.auto/proxy.sh` — the rulers. Editing the measurement path mid-session
  invalidates all data.
  (Adding *more* METRIC outputs for diagnostics is allowed; changing what
  `probe_total` measures is not.)
- `npm/` package internals — you may remove a package from `settings.json`;
  you may not patch installed package code.
- `skills/agents-skills/` — default OFF, contributes nothing to overhead.
- The probe prompt itself (`bench/probe-variant.sh`) — fixed for comparability.

## Constraints

- `checks.sh` must pass (behavioral workload intact) — enforced by the harness.
- `probe_requests` must remain 1.
- Variant must boot and answer the probe (a config that crashes pi is `crash`,
  not a win).
- Repo must remain installable per README (fresh `cp …` + `pi install` flow).
- Commit kept changes with `exp:` prefix, one idea per experiment. Attribute the
  delta in the message, e.g. `exp: drop pi-context-usage → probe_total 4012→3977 (−35)`.

## What's Been Tried

- **Baseline: `probe_total = 4,016`** (2026-07-28, repo @ branch point, checks
  green, workload 12,526 tok). Live parity via proxy same day: **4,014** — the
  variant build is faithful (Δ = cwd line). Repo == live in overhead terms.
- **Measurement pathology #1 — phantom +14.7k (FIXED)**: first variant builds
  probed 18,677–18,746 vs live 2,356. Cause: **upstream pi-lean-ctx bug** —
  when `PI_CODING_AGENT_DIR` is set, it resolves config as
  `$PI_CODING_AGENT_DIR/agent/extensions/pi-lean-ctx/config.json` (doubled
  `agent/`, cf. their #930), misses, boots defaults (no replace mode, full tool
  surface). Fix: build-variant.sh mirrors the config at the doubled path.
  Worth an upstream issue.
- **Measurement pathology #2 — phantom −1.7k (FIXED)**: after fix #1, variant
  = 4,016 but direct live probe showed 2,356. Payload capture proved both send
  byte-identical requests (22 tools, same system prompt modulo cwd line) —
  proxied counts: variant 4,016, live 4,014. Cause: **provider-side prompt
  caching undercounts warm prefixes in raw usage** on direct calls (my ongoing
  session had warmed the live system-prompt prefix). Fix: all measurement
  through the capture proxy. Corollary for the operator: `bench/probe.sh`
  (direct) is cache-contaminated as a canary — a warm run can make a REGRESSED
  config pass the ≤4052 gate. Use cold or proxied probes for gating.
- Prior art (pre-session, see git log): thin-kernel consolidation
  5,789 → 4,014; removal of pi-mcp-adapter, pi-goal-list-loop-audit,
  pi-web-access, delegate.ts; tscg aggressive compression applied.
  Known structure: 15 packages + 6 pi-essentials extensions + ~103 tok overlay
  (APPEND_SYSTEM.md grew ~85 → ~103 est. since README was written).
- Known repo↔live drift: `extensions/rtk.ts` exists live but not in repo
  (build-variant symlinks it for parity). Resolving the drift (adopt or drop)
  is a legitimate experiment. Also: live `models.json` is 7.5KB vs repo 2.2KB
  (drift invisible to the probe — variants always use live models.json patched
  to the proxy — but relevant at finalize/install time).

*(Update this section as experiments accumulate: key wins, dead ends, per-package
cost table. A resuming agent must not re-measure costs already recorded here.)*

## Finalize Criteria

Stop early (write verdict + findings) when: (a) every package/extension has an
attributed cost AND no removal survives checks, OR (b) 3 consecutive structural
ideas fail to beat noise. Otherwise loop until interrupted. At finalize:
distill per-component costs into `findings.md`, sync README if anything was
kept, and note the recommended `pi remove`/edit list for live application —
the operator applies kept changes to live `~/.pi/agent` manually via the README
install flow.
