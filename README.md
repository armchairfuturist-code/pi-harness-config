# Pi Harness Config

Token-optimized, measurement-gated configuration for the [pi](https://github.com/badlogic/pi-mono) coding agent.

**This repo is the source of truth.** Install from GitHub — never hand-copy ad-hoc files from a live `~/.pi/agent`.

---

## For humans — the 30-second pitch

A drop-in config that makes `pi` cheaper and smarter to run:

- **Token-optimized**: tool-schema compression, context pruning, and a slimmed `workflow` tool schema keep every session lean (~7.7% system-prompt savings measured, more with the workflow slim).
- **Measurement-gated**: every token-affecting change goes through an observe → change → verify → ledger loop (`hil/`). No unproven tweaks.
- **Self-orchestrating**: `ce-lite` decides when to fan out to parallel subagents and when to just answer directly — so you get multi-agent power without paying for it on simple tasks.
- **Reproducible**: `install.sh` deploys every locked file, pins npm packages, and applies post-install patches. Same harness on every machine.

**Install (after pi base install):**

```bash
git clone https://github.com/armchairfuturist-code/pi-harness-config.git
cd pi-harness-config
./install.sh
```

**Recommend it if:** you run pi daily, care about token spend, and want a harness that improves itself through measurement rather than vibes.

---

## For AI agents — onboarding checklist

> Read this section first if you are an agent bootstrapping a machine. A human has already installed the **pi base install** (the `pi` binary + `~/.pi/agent` skeleton). Your job: deploy this harness on top, verify it, and confirm the machine is ready.

### Step 0 — Confirm prerequisites

```bash
pi --version            # pi base install present?
ls ~/.pi/agent          # exists (may be empty skeleton)
```

If `pi` is missing, stop and tell the human: the pi base install must come first.

### Step 1 — Clone

```bash
git clone https://github.com/armchairfuturist-code/pi-harness-config.git
cd pi-harness-config
```

**Clone location matters:** prefer a path outside Pi's config root (e.g. `~/pi-harness-config`). If you clone to `~/.pi`, this tree uses `bundled-skills/` (not `skills/`), so it is **not** auto-loaded as project skills — that is intentional and safe.

### Step 2 — Install

```bash
./install.sh
```

What it does, in order:
1. Deploys every locked file (see the install table below) to `~/.pi/agent/`, `~/.pi/tscg.json`, `~/.config/lean-ctx/`.
2. Pins npm packages from `packages.lock.json` via `pi install`.
3. Applies post-install patches (`patches/context-mode`, `patches/tscg`, `patches/dynamic-workflows`).
4. Prunes legacy `~/.pi/skills/` shadows for harness skill names.

Flags: `--check` (diff only, no writes) · `--settings` (overwrite provider/model with repo defaults) · `--skip-packages` (files only).

### Step 3 — Verify

```bash
./install.sh --check            # expect: no unexpected DIFF/FAIL for locked files
./scripts/harness-preflight.sh  # expect: exit 0, all OK
```

Apply runtime env (bash/zsh):

```bash
grep -q 'lean-ctx/env.tuning' ~/.bashrc 2>/dev/null \
  || echo 'source "$HOME/.config/lean-ctx/env.tuning.sh"' >> ~/.bashrc
source "$HOME/.config/lean-ctx/env.tuning.sh"
./scripts/harness-preflight.sh
```

(Fish: `set -gx PI_TRANSCRIPT_PRUNE 1`, `set -gx PI_PRUNE_KEEP 4`, `set -gx LEAN_CTX_EPHEMERAL_MIN_TOKENS 1000`.)

### Step 4 — Confirm the machine is ready

You are **done** when:

- [ ] `./install.sh --check` shows no FAIL for repo-managed files
- [ ] `./scripts/harness-preflight.sh` exits 0
- [ ] `pi` starts and loads the `workflow` tool (slimmed schema) + lean-ctx `ctx_*` tools
- [ ] `~/.pi/agent/skills/ce-lite/SKILL.md` exists (the orchestrator)
- [ ] No `~/.pi/skills/` shadows for harness skill names remain

### Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Preflight: `BAD skill shadow` | stale `~/.pi/skills/<name>` collides with agent skills | `rm -rf ~/.pi/skills/{ce-lite,harness-doctor,context-rot-forensics,graph-engineering,poor-mans-distill,shard-security}` then re-run |
| Preflight: `pi-lean-ctx expected X found Y` | live package ≠ lock | update `packages.lock.json` to the installed version (both repo **and** `~/.pi/agent/packages.lock.json`), commit |
| `[Skill conflicts]` on pi start | project skills shadow agent skills | `./install.sh` (prunes shadows) |
| Patches not applied | package version changed | run `node patches/*/apply-patches.mjs` (version-pinned — they refuse silently on mismatch) |
| `--check` FAIL on `settings.json` | live provider/model differs by design | expected unless you pass `--settings` |

### Where to look next

- **`hil/HANDOFF.md`** — current next-iteration instructions (what the harness is working on).
- **`hil/ledger.md`** — decision log; **do not redo** closed iterations.
- **`HARNESS.md`** — runtime constitution, re-read each turn.
- **`memory/consolidated.md`** — cross-machine context; keep current (run the `memory-consolidate` workflow and commit) or a fresh machine starts amnesiac.

---

## How ce-lite works (the orchestrator)

**ce-lite** (ships as `bundled-skills/ce-lite`) is the harness's decision-and-execution orchestrator — everything a session does routes through its 7-stage loop:

```
Grill → Contract → Plan → Diagnose axes → Execute → Verify → Compound
```

- **Grill** (`grill-me`, `grill-with-docs`): up to 5 sharp questions before any Contract work — nail the real goal, constraints, and definition of done before spending tokens.
- **Contract**: a 2–4 sentence scope contract the session stays on-the-hook for and later verifies against.
- **Plan**: choose the route (`Lookup` / `Simple` / `Contract`) and whether it's one-answer-direct or multi-stage.
- **Diagnose axes**: the routing decision. Two axes decide *how* work runs:
  - **action complexity** high → workflow fan-out (parallel subagents)
  - **context + action** high → isolated workers + indexing
  - otherwise → execute directly in-session (keep tokens low)
- **Execute**: route pieces to sized workers — mechanical leaves to small agents, workers/reviewers to medium, hard synthesis to a big agent. Custom `agent()` / `parallel()` / `phase()` scripts follow the `workflow-authoring` skill.
- **Verify**: check the contract's acceptance criteria; use a fresh-context reviewer/judge when judgment matters.
- **Compound**: update the skill shelf, refresh notes/indexes, append the lesson to memory so the next session is cheaper.

### When ce-lite fans out (and when it mustn't)

Invoke a **workflow** only when: 2+ independent workstreams run concurrently, a fresh-context reviewer/judge is required, or work crosses a handoff boundary. **Otherwise execute directly** — the whole point of "lite" is to *not* pay fan-out overhead for single-context work.

### How it composes the stack

| Layer | Role |
|---|---|
| **ce-lite** | orchestration policy (when to fan out, when not) |
| **Matt Pocock skills** (`ask-matt`, `research`, `tdd`, `code-review`, `to-spec`, `to-tickets`, …) | specialist method per phase — load lazily, only when the branch applies |
| **`@quintinshaw/pi-dynamic-workflows`** | the parallel execution engine (`workflow` tool: `agent()`/`parallel()`/`pipeline()`), journals, `resumeFromRunId` |
| **lean-ctx MCP tools** | context I/O: `ctx_read`/`ctx_grep`/`ctx_search`/`ctx_index`, knowledge store, shell allowlist |
| **wayfinder + tracker** | cross-session orientation (`.scratch/wayfinder/`) and ticket-based session-spanning work |

### Plan→Execute bridge (tickets → workflow)

`to-tickets` writes a dependency graph under `.scratch/<slug>/issues/`. `scripts/tickets-to-workflow.mjs` parses those tickets (title, status, blocked-by edges), builds dependency **waves**, and emits a saved workflow:

```bash
node scripts/tickets-to-workflow.mjs <feature-slug> [cwd]
# → run the saved workflow via the workflow tool: name="<slug>-execute"
```

That's the automation path from Plan (tickets) to Execute (parallel waves) — no hand-transcribing ticket graphs into workflow scripts.

---

## Configuration reference

### Skill paths (avoid collisions)

Pi loads skills from **two** places and warns on name collisions:

| Source | Path | When |
|--------|------|------|
| user (agent) | `~/.pi/agent/skills/<name>/SKILL.md` | always |
| project | `<cwd>/.pi/skills/<name>/SKILL.md` | every session cwd |

This repo ships skills under **`bundled-skills/`**. `install.sh` copies them **only** into `~/.pi/agent/skills/`.

**Do not** keep harness skills at `~/.pi/skills/` — that path **is** project skills whenever Pi runs with `cwd=$HOME`, so it collides with the agent copy and one side is skipped.

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

Decision log: **`hil/ledger.md`**. Next work: **`hil/HANDOFF.md`**. **Do not** change Locked knobs without HIL.

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
| `scripts/tickets-to-workflow.mjs` | `~/.pi/agent/scripts/` |
| `patches/dynamic-workflows/apply-patches.mjs` | `~/.pi/agent/patches/dynamic-workflows/` (then applied) |
| `workflows/**`, `memory/**` | under `~/.pi/` / `~/.pi/agent/` |

### Sanity after install

```bash
./scripts/harness-preflight.sh
node bench/workload-deterministic.mjs # no LLM
node bench/live-keep-ab.mjs # needs pi + model
# optional: bash hil/canaries/ctx-tool-exercise.sh (proxy + Lilac path)
```

### Multi-machine memory

`memory/*.md` ships with install and is the only context that crosses machines (lean-ctx indices are machine-local). Personal configs are identical across machines, so keep `memory/consolidated.md` current: run the `memory-consolidate` saved workflow and **commit the result** — otherwise a fresh machine starts amnesiac.

---

## Design (why these files exist)

### `HARNESS.md` — runtime constitution
Stable rules re-read each turn. Keep short.

### `APPEND_SYSTEM.md` — per-turn system append
Injected every turn (~187 bytes). Durable policy goes in `HARNESS.md` or skills, not here.

### `settings.json` — pi agent config
Packages list, extension paths, compaction, thinking level. Repo bench default provider is Lilac/glm-5.2; live installs preserve the machine's model unless `--settings`.

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
settings.json # agent config
tscg.json # → ~/.pi/tscg.json
packages.lock.json # npm pins
HARNESS.md # constitution
APPEND_SYSTEM.md # tiny per-turn append
AGENTS.md # pointer for agents reading this repo
extensions/ # pruner, rot-sentinel, lib/prune-core.mjs
bundled-skills/ # ce-lite orchestrator + shipped skills → ~/.pi/agent/skills only
lean-ctx/ # env.tuning + lean-ctx rules
patches/ # post-install npm patches (context-mode, tscg, dynamic-workflows)
install.sh # deploy
scripts/ # preflight, validators, unattended-loop, tickets-to-workflow.mjs
bench/ # measurement
hil/ # HIL loop, ledger, canaries, traces
docs/ # design notes
```

## Auth (not in git)

```bash
pi auth login openai --api-key "$OPENAI_API_KEY"
# other providers via pi auth / local models.json — never commit secrets
```

## Upstream projects & credits

This harness configures, patches, and composes open-source projects. Sources:

| Component | Upstream | Role here |
|---|---|---|
| **pi** (the agent) | [github.com/badlogic/pi-mono](https://github.com/badlogic/pi-mono) | the coding agent this configures |
| **lean-ctx** (MCP context tools) | [github.com/yvgude/lean-ctx](https://github.com/yvgude/lean-ctx) · [leanctx.com](https://leanctx.com) | `ctx_*` tools, knowledge store, shell allowlist; pinned via `packages.lock.json` |
| **pi-lean-ctx** bridge | [github.com/yvgude/lean-ctx](https://github.com/yvgude/lean-ctx) (npm `pi-lean-ctx`) | Pi extension wiring lean-ctx into the agent |
| **pi-tscg** (tool-schema compression) | [github.com/Nick-Wolf-HLK/pi-tscg](https://github.com/Nick-Wolf-HLK/pi-tscg) | `tscg.json` + `patches/tscg/` |
| **context-mode** | [github.com/mksglu/context-mode](https://github.com/mksglu/context-mode) | context-mode admin tools toggle (`patches/context-mode/`) |
| **pi-dynamic-workflows** | [github.com/QuintinShaw/pi-dynamic-workflows](https://github.com/QuintinShaw/pi-dynamic-workflows) | `workflow` tool engine; slimmed by `patches/dynamic-workflows/` |
| **Matt Pocock skills** | [github.com/mattpocock/skills](https://github.com/mattpocock/skills) (via `agent-skills` npm) | `ask-matt`, `grill-me`, `to-spec`, `to-tickets`, `tdd`, `code-review`, … |

## License

MIT
