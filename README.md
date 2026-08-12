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
ctx_ls, ctx_edit, and ctx_shell. With the `lean` tool profile pinned
(see [Tool profile](#tool-profile-lean--the-bigger-lever) below), MCP on
costs only ~+1,300 tok/turn over MCP off — the gateway keeps all 82 tools
callable without paying their schema cost. MCP adds the expansion surface:

| Tool | Capability | CLI equivalent? |
|---|---|---|
| `ctx_search` | BM25 + trigram + RRF knowledge retrieval | No (lean-ctx recall is simpler BM25) |
| `ctx_fetch_and_index` | Web search + markdown indexing | No |
| `ctx_batch_execute` | Parallel commands + auto-indexing | No |
| `ctx_execute` | Sandbox code execution (Think-in-Code) | No |
| `ctx_knowledge` | Knowledge base management + embeddings reindex | No (embeddings reindex is MCP-only) |

### Why MCP is on by default

With the `lean` tool profile, MCP on costs ~5,300 tok/turn — barely more
than MCP off at ~4,003. The old `power` profile made MCP on cost ~12,694
(see the [tool profile section](#tool-profile-lean--the-bigger-lever) for
that discovery). At ~1,300 tok/turn overhead, MCP pays for itself by
eliminating even a single extra turn. So why ship it on?

Because most sessions aren't one-off requests. In a typical coding or
research session (5+ turns, moderate content), the expansion tools pay for
themselves and then some:

- **Fewer turns.** `ctx_batch_execute` runs 7 commands in one call instead of 7 sequential turns. Each avoided turn saves more tokens than the expansion costs for that turn.
- **Smaller content.** `ctx_search` returns 2 KB of relevant results instead of dumping a 20 KB file into context. That 18 KB difference dwarfs the 1.7 KB tool-schema overhead.
- **Web search.** `ctx_fetch_and_index` can pull web content into the knowledge base — there is no CLI equivalent. A task that requires web sources is simply impossible without it.
- **Sandbox execution.** `ctx_execute` runs code without putting raw bytes into the conversation. Processing a 700 KB log in-sandbox and printing a 3 KB summary costs 3 KB of context; reading it directly costs 700 KB.
- **Semantic retrieval.** `ctx_knowledge` enables embeddings reindex for semantic/hybrid search — the only known path, since the CLI can't trigger it.

#### Measured evidence — A/B test (same tasks/backend, MCP off vs on)

The rationale isn't theoretical. We ran the same benchmark tasks from the
`bench-systima` gradient rig on the same model (prompt caching disabled, so
every turn pays full cost) with MCP off (July 29 baseline) and MCP on
(August 10):

| Task | MCP off turns | MCP on turns | MCP off tokens | MCP on tokens | Savings |
|------|--------------|-------------|----------------|---------------|---------|
| Task | MCP off turns | MCP on turns | MCP off tokens | MCP on tokens (power) | Savings |
|------|--------------|-------------|----------------|----------------------|---------|
| T1: list files → files.txt | 7 | 1 | 28,021 | 12,694 | **−55%** |
| T3: fix multiply bug + changelog | 5 | 1 | 20,015 | 12,694 | **−37%** |
| **Combined** | **12** | **2** | **48,036** | **25,388** | **−47%** |

With `lean` profile (current), the MCP-on per-turn cost drops from ~12,694
to ~5,300 — projected savings become **−81%** (T1) and **−74%** (T3). The
A/B test above was measured with `power`; the lean numbers are projected
from the measured +2.9K injection.

Per-turn overhead (no prompt caching — full cost on every turn):

| Config | Tools | Per-turn overhead |
|--------|-------|-------------------|
| MCP off (lean floor) | 22 | ~4,003 tok |
| MCP on + `lean` profile (current) | 12 + 70 via gateway | ~5,300 tok |
| MCP on + `power` profile (old) | 63 | ~12,694 tok |

With `lean`, MCP on costs only ~1,300 tok/turn more than off — and all 82
tools remain callable via `ctx_call`. The old `power` config paid +8,691.

#### Break-even point

With `lean` profile, MCP's overhead is only ~1,300 tok/turn (was +8,691
with `power`). The math:

| Turns eliminated | Net token delta | Verdict |
|-----------------|-----------------|---------|
| 0 (1→1) | +1,300 | MCP loses (trivial tasks) |
| 1 (2→1) | −2,703 | MCP wins |
| 3 (5→2) | −6,709 | MCP wins |
| 6 (7→1) | −18,718 | MCP wins big |

**Break-even: MCP wins when a task takes ≥2 turns without it** (eliminating
≥1 turn). With `power` the threshold was ≥5 turns. 73% of this user's
sessions are 40+ turns — far past either threshold. A 40-turn session
compresses to ~10–15 turns with batch execution and content compression,
saving 60%+ of total tokens.

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

The manual toggle is the only lever for the schema cost. With `lean`
profile the overhead is small enough that toggling off is only worth it for
single-turn requests (<2 turns):

```fish
bash ~/.pi/agent/scripts/mcp-toggle.sh status   # show current state
bash ~/.pi/agent/scripts/mcp-toggle.sh off  # MCP off (~4,003 t/t)
bash ~/.pi/agent/scripts/mcp-toggle.sh on   # MCP on + lean profile (~5,300 t/t)
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

The ~1,300 token schema overhead (lean profile) adds ~3 ms of prefill per
turn — negligible against the seconds saved by eliminating round-trips.



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
| Preflight: `BAD skill shadow` | stale `~/.pi/skills/<name>` collides with agent skills | `rm -rf ~/.pi/skills/{ce-lite,harness-doctor,context-rot-forensics,graph-engineering,shard-security}` then re-run |
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
# optional: bash hil/canaries/ctx-tool-exercise.sh (proxy path)
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
| **Pi optimized (MCP off)** | **~4,003** | **22** | **2026-08-05** | **commit `68a7080`** |
| **Pi MCP on + power profile** | **~12,694** | **63** | **2026-08-10** | **pre-lean (A/B test)** |
| **Pi MCP on + lean profile** | **~5,300** | **12+gateway** | **2026-08-10** | **commit (lean switch)** |

### ce-lite-preload A/B (2026-08-10, 911 real sessions, no LLM)

`extensions/ce-lite-preload.ts` deterministically injects the CE-lite routing
contract once per session on non-trivial prompts (no more relying on the model
voluntarily reading the skill). Measured against 911 historical sessions with
`bench/ce-lite-preload-ab.mjs` (jiti-loads the *deployed* extension, replays
each real first prompt, and checks each session's actual tool calls):

| Metric | Value |
|---|---|
| Injected payload (stub) | **~267 tok** (1,067 chars) |
| Injected payload (full SKILL body, opt-in) | ~1,623 tok (6,490 chars) |
| Stub savings vs full body | **−84%** |
| Heuristic match rate (real traffic) | 89% |
| **Recall on genuinely multi-step sessions** (≥2 tool calls) | **93%** (718/774) |
| Chat-like false matches (worst-case bloat) | 96/911 |
| Worst-case bloat at match | ~25.6K tok over 911 sessions ≈ 28 tok/session |
| Voluntary skill-read baseline (APPEND_SYSTEM only) | **18%** (167/911) |
| Deterministic activation vs baseline | 18% → **93%** of multi-step sessions |
| KV-cache impact (H4) | none — never touches `systemPrompt`; custom message → user role |

**Read:** the preload turns a *fragile* 18% voluntary activation into a *deterministic*
93% coverage of real multi-step sessions, at a payload ~1/6th the size of the
skill body it replaces, with chat-like false matches bounded under ~28 tok/session
average. Kill/force flags: `CE_LITE_PRELOAD=0|1|force`; full body via `CE_LITE_PRELOAD_FULL=1`.
Re-run: `node bench/ce-lite-preload-ab.mjs`. Double-read (preload + later
voluntary SKILL.md read) is measured post-deploy by the same harness.

## Thinking levels

Thinking is **static pins**, not an auto-raiser.

- **Floor:** machine-local `defaultThinkingLevel` in `~/.pi/agent/settings.json` (not committed). Recommendation: `medium`.
- **Per-model:** live `model-thinking.json`. Pin exceptions only after a canary.
- **User levers:** `/think`. `xhigh`/`max` stay user-only.
- **Removed:** `@howaboua/pi-auto-reasoning-tool` and the harness raise-only patch. The package could only raise, switched cache lanes, and did not save tokens on this pin table.

## Design (why these files exist)

**Result: ~4,003 tok/turn with MCP off; ~5,300 tok/turn with MCP on + `lean` profile (was ~12,694 with `power`). The `lean` profile was the single biggest win — −9.8K tok/turn vs `power` at zero capability cost (all 82 tools stay callable via `ctx_call`). MCP on + lean wins for any task ≥2 turns; toggle off only for single-turn requests.**

### `HARNESS.md` — runtime constitution
Stable rules re-read each turn. Keep short.

### `APPEND_SYSTEM.md` — per-turn system append
Injected every turn (~187 bytes). Durable policy goes in `HARNESS.md` or skills, not here.

### `settings.json` — pi agent config
Packages list, extension paths, compaction, thinking level. **Provider-agnostic:** the repo ships a neutral template default; live installs
preserve the machine's own provider/model/thinking/enabledModels (and the
per-machine model-map files) unless you pass `--settings`. Do not hardcode any
particular provider or model in this repo — operators rotate backends for
cost, and the harness must not care which one is live.

### `tscg.json` — tool-schema compression
**Path is `~/.pi/tscg.json`** (pi-tscg home root). Aggressive param-description strip is on; `aggressiveMaxDescChars` **20** (Iter 12). Repo `tscg.json` is what probe/build-variant uses — keep live in sync.

### Extensions — why only these

The harness runs **5 core extensions, on purpose.** Every always-loaded extension
adds tokens to the model's context and another surface to maintain. The rule:
**a new extension must earn its place through the HIL gate** (observe → one
change → verify → ledger), and self-contained capabilities ship as npm packages
instead of repo extensions whenever possible — so the repo file count stays low
and bloat stays gated.

| Extension | Why it exists |
|-----------|---------------|
| `transcript-pruner.ts` + `lib/prune-core.mjs` | Pointer-replaces spent tool output (CLEAR/DEDUP/STALE, KEEP via `PI_PRUNE_KEEP`) so long sessions don't rot — the enforcement arm of the KEEP=4 doctrine. |
| `session-index.ts` | Writes zero-token session summaries on shutdown (no LLM call) so past work is findable cross-session without paying for a memory tool. |
| `runtime-discipline.ts` | Event-driven recovery guidance + cache-stable long-session notices — keeps `HARNESS.md` behavior on rails on long runs. |
| `rot-sentinel.ts` | Hooks the pre-LLM `context` event and detects rot in real time, triggering a handoff before quality degrades. |
| `ce-lite-preload.ts` | Deterministically injects the ce-lite orchestration contract on turn 1 at ~1/6th the payload of a voluntary skill read — the biggest measured A/B win in this repo (911 sessions, 2026-08-10). |

Newest additions ship as npm packages, not repo files — self-contained,
individually gated:

- **pi-smart-btw** — the `/btw` side-thread: renders a question slot *outside*
  the main model context (cheap child session, inject/discard with Alt+C/Alt+X)
  so side questions never pay the main-context re-prefill or interrupt the
  active contract. Zero always-on tokens.

  > **Model note:** the upstream package defaults `/btw` to
  > `openai-codex/gpt-5.6-luna`, which fails with `No API key found for
  > openai-codex` on machines without an OpenAI Codex key. `install.sh`
  > auto-assigns `/btw` a cheap model from your own registry via
  > `scripts/ensure-btw-model.mjs` (prefers your active `defaultProvider`;
  > `~/.pi/agent/pi-smart-btw.json` overrides it, or set `ENSURE_BTW_MODEL`).

- **pi-skill-model-facing-api-design** — a *skill*, not an extension: gives the
  HIL gate the craft for measuring and designing model-facing tool contracts
  (`tool-token-lines.mjs` prices a tool's schema in tokens). ~40 tok catalog
  description; body read only when needed.

- **pi-clarify** — pre-send prompt sharpening: `/clarify <rough idea>` (or a
  `-clarify` marker anywhere in a message) runs one small model turn and writes
  a terminology-precise rewrite back into the editor via `setEditorText` —
  the agent does not run until you send it. The rewrite stays **out of the
  session** (`cacheRetention: "none"`); pin a cheap model in
  `~/.pi/agent/clarify.json` (`/clarify model <provider> <model>`). ~0
  always-on tokens (slash command + input listener, no tool schema).
  **Replaces the retired `/skill:prompt-sharpen`** (~/.agents/skills user
  skill): same input-stage-sharpening niche, but out-of-context and
  cheap-model-pinnable. prompt-sharpen was redundant under ce-lite routing
  (see `hil/ledger.md`, Iter 16).

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
pi auth login   # CLI: select your provider + key interactively
# or `pi auth login <provider> --api-key "$KEY"` for scripting.
# Provider/model choice lives in live ~/.pi/agent/settings.json (or models.json),
# never in this repo — and never commit secrets.
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
| **pi-clarify** | [github.com/dodo-reach/pi-clarify](https://github.com/dodo-reach/pi-clarify) (npm `pi-clarify`) | pre-send prompt rewriting via `/clarify` + `-clarify` marker; pinned via `packages.lock.json` |
| **Matt Pocock skills** | [github.com/mattpocock/skills](https://github.com/mattpocock/skills) (via `agent-skills` npm) | `ask-matt`, `grill-me`, `to-spec`, `to-tickets`, `tdd`, `code-review`, … |

## License

MIT
