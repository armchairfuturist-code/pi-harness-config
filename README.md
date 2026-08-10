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

## MCP expansion

The `toolProfile: "lean"` floor always provides ctx_read, ctx_grep, ctx_find,
ctx_ls, ctx_edit, and ctx_shell (~3,757 tokens/turn). Enabling MCP adds the
expansion surface for ~+1,757 tokens/turn:

| Tool | Capability | CLI equivalent? |
|---|---|---|
| `ctx_search` | BM25 + trigram + RRF knowledge retrieval | No (lean-ctx recall is simpler BM25) |
| `ctx_fetch_and_index` | Web search + markdown indexing | No |
| `ctx_batch_execute` | Parallel commands + auto-indexing | No |
| `ctx_execute` | Sandbox code execution (Think-in-Code) | No |
| `ctx_knowledge` | Knowledge base management + embeddings reindex | No (embeddings reindex is MCP-only) |

### Why MCP is on by default

Enabling MCP raises the fixed token cost per turn by ~1,757 — from 3,757
to ~5,514. That's a real tax on every turn, including ones that never use
these tools. So why ship it on?

Because most sessions aren't one-off requests. In a typical coding or
research session (5+ turns, moderate content), the expansion tools pay for
themselves and then some:

- **Fewer turns.** `ctx_batch_execute` runs 7 commands in one call instead of 7 sequential turns. Each avoided turn saves more tokens than the expansion costs for that turn.
- **Smaller content.** `ctx_search` returns 2 KB of relevant results instead of dumping a 20 KB file into context. That 18 KB difference dwarfs the 1.7 KB tool-schema overhead.
- **Web search.** `ctx_fetch_and_index` can pull web content into the knowledge base — there is no CLI equivalent. A task that requires web sources is simply impossible without it.
- **Sandbox execution.** `ctx_execute` runs code without putting raw bytes into the conversation. Processing a 700 KB log in-sandbox and printing a 3 KB summary costs 3 KB of context; reading it directly costs 700 KB.
- **Semantic retrieval.** `ctx_knowledge` enables embeddings reindex for semantic/hybrid search — the only known path, since the CLI can't trigger it.

#### Measured evidence — A/B test (Lilac GLM-5.2, same tasks, MCP off vs on)

The rationale isn't theoretical. We ran the same benchmark tasks from the
`bench-systima` gradient rig on the same model (Lilac GLM-5.2, no prompt
caching) with MCP off (July 29 baseline) and MCP on (August 10):

| Task | MCP off turns | MCP on turns | MCP off tokens | MCP on tokens | Savings |
|------|--------------|-------------|----------------|---------------|---------|
| T1: list files → files.txt | 7 | 1 | 28,021 | 12,694 | **−55%** |
| T3: fix multiply bug + changelog | 5 | 1 | 20,015 | 12,694 | **−37%** |
| **Combined** | **12** | **2** | **48,036** | **25,388** | **−47%** |

Per-turn overhead on Lilac (no prompt caching, full cost every turn):

| Config | Tools | Per-turn overhead |
|--------|-------|-------------------|
| MCP off (lean floor) | 22 | ~4,003 tok |
| MCP on (full expansion) | 63 | ~12,694 tok |
| Delta | +41 | +8,691 tok |

#### Break-even point

MCP's +8,691 tok/turn overhead is amortized when a task eliminates enough
turns. The math:

| Turns eliminated | Net token delta | Verdict |
|-----------------|-----------------|---------|
| 1 (7→6) | +4,691 | MCP loses |
| 2 (7→5) | −690 | MCP wins |
| 3 (7→4) | −3,099 | MCP wins |
| 6 (7→1) | −15,327 | MCP wins big |

**Break-even: MCP wins when a task would take ≥5 turns without it**
(eliminating ≥2 turns). 73% of this user's sessions are 40+ turns — well
past the threshold. A 40-turn session compresses to ~10–15 turns with
batch execution and content compression, saving 60%+ of total tokens.

#### Why not auto-toggle per request?

MCP can't auto-toggle mid-session — tool schemas are loaded once at startup
and baked into every request's system prompt. The overhead isn't from
*calling* MCP tools; it's from their *definitions* being present whether or
not they're used.

**ce-lite already handles the usage level.** Its Grill → Plan → Diagnose
routing already decides "this is a Simple task, just read + edit, don't
batch/search/fan-out." For a "fix this typo" request, ce-lite never calls
`ctx_batch_execute` or `ctx_search` — it goes straight to `ctx_read` →
`ctx_edit`. You only pay the 1,757 token schema tax, not the tool-call
cost.

The manual toggle is the only lever for the schema cost. It's worth using
when you know in advance the entire session will be <5 turns:

```fish
bash ~/.pi/agent/scripts/mcp-toggle.sh status   # show current state
bash ~/.pi/agent/scripts/mcp-toggle.sh off       # lean floor only (~3,757 t/t)
bash ~/.pi/agent/scripts/mcp-toggle.sh on        # +expansion (~5,514 t/t)
```

Toggle requires a new Pi session to take effect (schemas load at startup).
The `lean-ctx/pi-config.json` in this repo sets `enableMcp: true` as the
default; `install.sh` deploys it.

#### Perceived speed (why it feels snappier)

Output TPS is unchanged — same model, same generation rate. But total
response time drops for two reasons:

- **Fewer round-trips.** Each LLM turn carries fixed latency (network,
  queue, prefill) before the first output token. Compressing 7 turns into 1
  eliminates 6 latency penalties — seconds saved, not milliseconds.
- **Slower context growth.** `ctx_search` returns 2 KB snippets instead of
  20 KB files; `ctx_execute` keeps raw bytes in-sandbox. Later turns in a
  long session prefill faster because the context window stays smaller.

The +1,757 token schema overhead adds ~5 ms of prefill per turn — negligible
against the seconds saved by eliminating round-trips.



### Tool profile (lean) — the bigger lever

Separate from the MCP on/off toggle is **how many tool schemas are injected
per turn** — and it dwarfs the MCP delta. lean-ctx has profiles:

| Profile | Advertised tools | Injection/turn |
|---------|-----------------|----------------|
| `power` | 82 (all first-class) | ~+12.7K |
| `lean` (ours) | 12 core + rest via gateway | ~+2.9K |
| `auto` | 5→escalates with complexity | ~+1.9K start |

The repo pins `lean` in `lean-ctx/config.toml` (deployed by `install.sh`).
That's **~9.8K tok/turn saved** vs `power`, at zero capability cost: all 82
tools remain callable through the gateway — `ctx_call(name, args)` (MCP) or
`lean-ctx call <tool> --json '<args>'` (shell). `HARNESS.md` carries a
routing anchor listing the high-value gateway tools so the model knows to
reach for them despite not seeing their schemas.

Why `lean` and not `auto`: `auto` starts cheapest but its escalation
heuristic is undocumented, and its initial 5 omit the gateway (`ctx_call`)
and editing (`ctx_patch`) — so the gateway is undiscoverable at start. `lean`
is lean-ctx's own marked default, deterministic, and its 12 include
`ctx_call` + `ctx_patch` + `ctx_compose`. Try `auto` via one env var:
`LEAN_CTX_TOOL_PROFILE=auto`.

A preflight watchdog (daemon phantom #930) fails the build if the live
profile drifts from the repo pin — a fresh daemon booting on defaults would
otherwise silently balloon the surface back to ~82.

### Embeddings

Knowledge facts created before ONNX Runtime was provisioned have zero
embedding vectors, blocking semantic and hybrid retrieval. Fix:

```fish
bash ~/.pi/agent/scripts/fix-embeddings.sh   # check + instructions
# Then in a Pi session with MCP enabled:
#   ctx_knowledge(action="embeddings_reindex")
# Verify: lean-ctx knowledge lifecycle
```

All embedding generation is local (ONNX Runtime). No API calls, no data leaves
the machine.

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

| Config | Tokens | Tools | Date | Source |
|---|---|---|---|---|
| OMP v16.4.3 | ~16,800 | 11 | 2026-07-22 | `docs/wayfinder-agents-optimization.md` |
| Pi pre-CE-lite | 5,789 | ~25 | 2026-07-27 | commit `c9cd69f` message |
| Pi CE-lite baseline | 4,014 | ~22 | 2026-07-27 | commit `c9cd69f` |
| Pi drifted master | 5,750 | 31 | 2026-08-05 | commit `93ec746` |
| **Pi optimized (MCP off)** | **3,757** | **17** | **2026-08-05** | **commit `68a7080`** |
| **Pi optimized (MCP on)** | **~5,514** | **23** | **2026-08-10** | **commit (this change)** |

## Design (why these files exist)

**Result: 3,757 tokens with MCP off (lean floor only); ~5,514 tokens with MCP on (full expansion). The +1,757 token/turn cost of MCP is worth it for most sessions — the tools it enables (web search, knowledge retrieval, batch execution, sandbox) save more tokens than they cost by reducing turns and compressing content. For one-off requests, toggle MCP off.**

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

## Tracking extension updates

Extensions update often; `packages.lock.json` pins what we run, but we want to
*notice* upstream changes deliberately rather than discover breakage later.

```fish
bash scripts/check-extension-updates.sh          # report: which pkgs have updates
bash scripts/check-extension-updates.sh --notes  # + GitHub release notes for each
bash scripts/check-extension-updates.sh --strict # exit 1 if any update (for CI)
bash scripts/check-extension-updates.sh --json   # machine-readable
```

**Pinned packages need re-patching on update.** Three extensions are patched at
an exact version and will refuse / misbehave if bumped blindly:

| Package | Pin | Patch |
|---------|-----|-------|
| `context-mode` | 1.0.169 | removes admin tools (`ctx_stats`, `ctx_doctor`, …) |
| `@quintinshaw/pi-dynamic-workflows` | 3.5.1 | slims workflow-tool schema (−450 to −1,000 tok) |
| `pi-tscg` | 0.2.4 | recursive nested-descriptor truncation |

The script flags these `[PINNED—re-patch required]`. To adopt an update: bump
`packages.lock.json`, `npm i <pkg>@latest`, re-run `install.sh` (re-applies
patches), then `./scripts/harness-preflight.sh` — it fails if a patch no longer
matches. Preflight also surfaces available updates (warn-only) on every install,
so drift is visible without a separate cron.

**Recommended cadence:** run `--notes` weekly or before any token-affecting
change; bump safe packages freely, re-verify pinned ones via the HIL loop.

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
