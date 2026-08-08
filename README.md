# Pi Harness Config

Token-optimized, measurement-gated configuration for the [pi](https://github.com/badlogic/pi-mono) coding agent.

**This repo is the source of truth.** Other machines and agent homes should install from GitHub — do not hand-copy ad-hoc files from a live `~/.pi/agent`.

---

## For other agents / machines


## Skill paths (avoid collisions)

Pi loads skills from **two** places and warns on name collisions:

| Source | Path | When |
|--------|------|------|
| user (agent) | `~/.pi/agent/skills/<name>/SKILL.md` | always |
| project | `<cwd>/.pi/skills/<name>/SKILL.md` | every session cwd |

This repo ships skills under **`bundled-skills/`**. `install.sh` copies them **only** into `~/.pi/agent/skills/`.

**Do not** keep harness skills at `~/.pi/skills/` — that path **is** project skills whenever Pi runs with `cwd=$HOME`, so it collides with the agent copy and one side is skipped.

### Clone location

- **Preferred:** clone outside Pi's config root, e.g. `~/pi-harness-config`, then `./install.sh`.
- **If you clone to `~/.pi`:** this tree uses `bundled-skills/` (not `skills/`) so a checkout at `~/.pi` is not auto-loaded as project skills. Legacy `~/.pi/skills/` trees from older checkouts are pruned by `install.sh`.

### After pull / if you see `[Skill conflicts]`

```bash
./install.sh
# or only clear shadows:
rm -rf ~/.pi/skills/{ce-lite,harness-doctor,context-rot-forensics,graph-engineering,poor-mans-distill,shard-security}
```

`./install.sh --check` and `scripts/harness-preflight.sh` fail on leftover project shadows for harness skill names.


### Exact update sequence

1. `git clone` or `git pull` https://github.com/armchairfuturist-code/pi-harness-config
2. `./install.sh` — deploys every locked file (see table below)
3. Source runtime env (KEEP=4 + lean-ctx thresholds)
4. `./scripts/harness-preflight.sh` — fail closed if incomplete
5. **Do not** change Locked knobs without HIL (`hil/ledger.md`)

Provider + model stay **machine-local** by default (`install.sh` merges live `defaultProvider` / `defaultModel` unless you pass `--settings`).

### Install

```bash
git clone https://github.com/armchairfuturist-code/pi-harness-config.git
cd pi-harness-config
./install.sh
# optional: force repo provider/model defaults
# ./install.sh --settings
# optional: files only (skip `pi install` pins)
# ./install.sh --skip-packages
# drift check without writing:
# ./install.sh --check
```

Apply runtime env (bash/zsh):

```bash
grep -q 'lean-ctx/env.tuning' ~/.bashrc 2>/dev/null \
  || echo 'source "$HOME/.config/lean-ctx/env.tuning.sh"' >> ~/.bashrc
source "$HOME/.config/lean-ctx/env.tuning.sh"
./scripts/harness-preflight.sh
```

Fish:

```fish
set -gx PI_TRANSCRIPT_PRUNE 1
set -gx PI_PRUNE_KEEP 4
set -gx LEAN_CTX_EPHEMERAL_MIN_TOKENS 1000
```

### Locked knobs (do not freestyle)

| Knob | Value | Deployed from → to | Evidence |
|------|-------|--------------------|----------|
| `PI_PRUNE_KEEP` | **4** | `lean-ctx/env.tuning.sh` → `~/.config/lean-ctx/env.tuning.sh` (+ shell rc) | HIL Iter 9b |
| Compaction `reserveTokens` | **24000** | `settings.json` → `~/.pi/agent/settings.json` | Iter 7 left |
| Compaction `keepRecentTokens` | **20000** | same | same |
| TSCG aggressive strip | **true** | `tscg.json` → **`~/.pi/tscg.json`** (not under `agent/`) | Iter 5 KEEP |
| TSCG `aggressiveMaxDescChars` | **20** | same | Iter 12 KEEP |
| Extensions | pruner, session-index, runtime-discipline, **rot-sentinel** | `settings.json` + `extensions/*` | Iter 8–11 |
| Packages | pins in `packages.lock.json` | `pi install` via install.sh | lockfile |

Decision log: **`hil/ledger.md`**. Next work: **`hil/HANDOFF.md`**.

### What `install.sh` writes

| Repo path | Live destination |
|-----------|------------------|
| `settings.json` | `~/.pi/agent/settings.json` (keeps live provider/model) |
| `tscg.json` | `~/.pi/tscg.json` |
| `packages.lock.json` | `~/.pi/agent/packages.lock.json` + pinned `pi install` |
| `HARNESS.md`, `APPEND_SYSTEM.md`, `AGENTS.md` | `~/.pi/agent/` |
| `extensions/*.ts`, `extensions/lib/prune-core.mjs` | `~/.pi/agent/extensions/` |
| `bundled-skills/*` (ce-lite, harness-doctor, …) | `~/.pi/agent/skills/` only — never `~/.pi/skills/` |
| `lean-ctx/env.tuning.sh` | `~/.config/lean-ctx/env.tuning.sh` |
| `lean-ctx/config.toml` | `~/.config/lean-ctx/config.toml` |
| `lean-ctx/pi-config.json` | `~/.pi/agent/extensions/pi-lean-ctx/config.json` |
| `patches/**` + apply scripts | `~/.pi/agent/patches/` then applied into npm |
| `scripts/harness-preflight.sh` + validators | `~/.pi/agent/scripts/` |
| `workflows/**`, `memory/**` | under `~/.pi/` / `~/.pi/agent/` |

Flags: `--check` (diff only), `--settings` (overwrite provider/model), `--skip-packages`.

### Sanity after install

```bash
./scripts/harness-preflight.sh
node bench/workload-deterministic.mjs   # no LLM
node bench/live-keep-ab.mjs             # needs pi + model
# optional: bash hil/canaries/ctx-tool-exercise.sh  (proxy + Lilac path)
```

---

### Multi-machine memory

`memory/*.md` ships with install and is the only context that crosses machines (lean-ctx indices are machine-local). Personal configs are identical across machines, so keep `memory/consolidated.md` current: run the `memory-consolidate` saved workflow and **commit the result** — otherwise a fresh machine starts amnesiac.

---

## Design (why these files exist)

### `HARNESS.md` — runtime constitution

Stable rules re-read each turn. Keep short.

### `APPEND_SYSTEM.md` — per-turn system append

Injected every turn (~187 bytes). Durable policy goes in `HARNESS.md` or skills, not here.

### `settings.json` — pi agent config

Packages list, extension paths, compaction, thinking level. Repo bench default provider is Lilac/glm-5.2; live installs preserve the machine’s model unless `--settings`.

### `tscg.json` — tool-schema compression

**Path is `~/.pi/tscg.json`** (pi-tscg home root). Aggressive param-description strip is on; `aggressiveMaxDescChars` **20** (Iter 12). Repo `tscg.json` is what probe/build-variant uses — keep live in sync.

### Extensions

| File | Role |
|------|------|
| `transcript-pruner.ts` + `lib/prune-core.mjs` | CLEAR/DEDUP/STALE; KEEP via `PI_PRUNE_KEEP` |
| `session-index.ts` | Session indexing |
| `runtime-discipline.ts` | Runtime discipline |
| `rot-sentinel.ts` | Context-rot signals + handoff trigger |

---

## Measurement (HIL)

Token-affecting changes: **observe → one change → verify → ledger**.

| Path | Purpose |
|------|---------|
| `hil/ledger.md` | Decision log (closed iters — do not redo) |
| `hil/HANDOFF.md` | Current next-iter instructions |
| `hil/observe.sh` / `hil/verify.sh` | Baseline + gate |
| `hil/canaries/` | Quality canaries |
| `bench/` | Probe, workload, det pruner, proxy |

**Locked as of Iter 12 (2026-08-08):** KEEP=4 · reserveTokens=24000 · keepRecentTokens=20000 · tscg strip on · maxDescChars=20.

### Token floor (variant probe)

| When | total_tokens | Notes |
|------|--------------|-------|
| Hygiene · 2026-08-08 | **2725** / schema **6529** | AGENTS.md 729B→319B (system prompt −408 chars); `.scratch/bench-results/hil-probe-systrim.json` |
| Iter 12 · 2026-08-08 | 2832 / schema 6529 | maxDesc=20; trace `hil/traces/20260808T070906-iter12-maxdesc20-20260808T070906Z.json` |
| Iter 11 · 2026-08-08 | **2737** / schema **6701** | maxDesc=30; `hil/traces/20260808T064135-iter11-baseline.json` |
| Older pi/provider epochs | various | **not comparable** — re-baseline after upgrades |

Live multi-turn medians can swing ±25% on non-det models; do not promote on one noisy run.

---

## Repo map

```
settings.json          # agent config
tscg.json              # → ~/.pi/tscg.json
packages.lock.json     # npm pins
HARNESS.md             # constitution
APPEND_SYSTEM.md       # tiny per-turn append
AGENTS.md              # pointer for agents reading this repo
extensions/            # pruner, rot-sentinel, lib/prune-core.mjs
bundled-skills/                         # shipped skills → ~/.pi/agent/skills only
lean-ctx/              # env.tuning + lean-ctx rules
patches/               # post-install npm patches
install.sh             # deploy
scripts/               # preflight, validators, unattended-loop
bench/                 # measurement
hil/                   # HIL loop, ledger, canaries, traces
docs/                  # design notes
```

## Auth (not in git)

```bash
pi auth login openai --api-key "$OPENAI_API_KEY"
# other providers via pi auth / local models.json — never commit secrets
```

## License

MIT
