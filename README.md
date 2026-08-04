# Pi Harness Config

A **thin, measured configuration** for the [Pi](https://pi.dev) coding agent.

**Goal:** keep the agent capable (multi-step coding, research, review) while
paying as little fixed context cost as possible — so sessions stay clear longer
and you spend less per task.

**Who it’s for:** operators who want one simple way of working, not a menu of
skills and plugins to memorize. You talk in plain language; the harness routes.

**Model-agnostic:** this repo is about *harness* behavior (tools, routing,
context hygiene), not a specific LLM. Bring your own provider and models.
Numbers in docs are from particular models on particular days — treat them as
evidence of direction, not as promises for your stack. Custom models will vary.

---

## The problem

Every chat turn re-sends a large pile of “always on” text: system rules, tool
schemas, skill catalogs, leftover tool output. That pile:

1. **Costs money** on every request (even a one-line answer).
2. **Crowds out real work** — useful context competes with boilerplate.
3. **Rotates reasoning** as the window fills (we measured serious degradation
   around ~40% fill on long sessions).

Most “power user” setups make this worse: more MCP servers, more always-on web
tools, more skills injected up front. This repo does the opposite: **earn every
always-on token**, load the rest only when needed.

---

## How it works (one picture)

```
You ask something
       │
       ▼
  CE-lite (orchestrator)
       │
       ├── simple question  → answer directly
       ├── needs sources    → fetch / research workflow
       ├── real project work → contract loop
│   ID’d terms → proportional plan/execution
│   → term-to-evidence matrix → fresh review → deliver
├── engineering change → risk overlay
│   lightweight / standard / critical controls
└── long / loop work → multi-session map or autoresearch
```

You never have to type skill names. A tiny always-on hook
(`APPEND_SYSTEM.md`) tells the model: *simple stuff direct; anything
non-trivial → open ce-lite and follow it.*

### CE-lite — the problem it solves

Without an orchestrator, agents either:

- dump every skill into the prompt (expensive, noisy), or  
- wait for you to remember `/skill-name` (fragile).

**CE-lite** is a single skill that:

- stays almost free when idle (other skills are **not** in the always-on list);
- turns vague asks into ID’d **acceptance terms** with yes/no pass conditions;
- chooses direct execution or workflow fan-out using objective triggers;
- maintains a term-to-evidence matrix and uses fresh-context review before claiming completion;
- applies risk-scaled engineering controls without imposing software ceremony on ordinary work;
- compounds learnings so the next similar task is cheaper.

Details live under `skills/ce-lite/`. Progressive disclosure keeps the core loop
small: grilling, wayfinding, gather/judge, context health, and engineering controls
load only when their branch runs. Engineering first loads
`ENGINEERING_PROFILE.md`, then exactly one effect-based mode:
`ENGINEERING_LIGHTWEIGHT.md`, `ENGINEERING_STANDARD.md`, or
`ENGINEERING_CRITICAL.md`.
grilling / wayfinding / gather-judge only when that branch runs).

### Mechanic's shelf (on demand)

ce-lite routes specialist work via an internal **mechanic's shelf**
(`skills/ce-lite/reference.md`) — implement, tdd, research, diagnosing-bugs,
code-review, domain-modeling, to-spec, to-tickets, handoff, and friends.
Those workers may live on disk under `~/.pi/agent/skills/`; only **ce-lite**
is allowlisted in `settings.json` so their descriptions stay out of every
prompt. The agent path-reads a shelf skill when the task shape matches and
**never names skills to you**.

**Multi-session SSOT:** living maps under `.scratch/wayfinder/` via
`skills/ce-lite/wayfinding.md`. Do not run the separate mattpocock `wayfinder`
skill protocol in a ce-lite session.

**Never auto-invoked under ce-lite:** `wayfinder`, `triage`, `ask-matt`,
`setup-matt-pocock-skills`, `improve-codebase-architecture` (operator-only),
and the grill aliases `grill-me` / `grill-with-docs` (use `grilling` +
`skills/ce-lite/grilling.md` instead).

**Tickets under wayfinding:** `to-tickets` defaults to map-adjacent files under
`.scratch/wayfinder/` — not GitHub/Linear — unless you ask for a tracker.

---

## Why there is no MCP and no always-on web search

This is intentional, not incomplete.

| Common add-on | Why it’s out of the default kernel |
|---------------|-------------------------------------|
| **MCP servers / MCP bridge** | Turning lean-ctx’s MCP expansion on ballooned the tool list **22 → 78 tools** and roughly **+9,600 tokens per request** on ordinary file tasks (same task A/B). No MCP servers were configured anyway — pure tax. Re-add only if you actually run MCP servers *and* re-measure. |
| **Always-on parent web tools** (`pi-web-access`) | ~1,000+ tokens of schemas on **every** turn. Web is available when needed via **workflow child agents** and `ctx_fetch_and_index` / last30days — paid only on research-shaped work. |
| **Always-on skill catalogs** | Dozens of skill descriptions every request. Here only **ce-lite** is always eligible; everything else loads on demand from triggers or ce-lite’s routing table. |
| **Extra agent frameworks** | Packages that never activated still cost schema. Removed after measurement. |

**Rule of thumb:** if it isn’t used on most turns, it must not sit in the
always-on prompt. Optional power is one install + one measure away — not the
default.

---

## Extensions (and why each exists)

Vendored under `extensions/`. Installed to `~/.pi/agent/extensions/`.

| Extension | What it does | Why |
|-----------|--------------|-----|
| **`transcript-pruner.ts`** | Before each model call, shrinks the chat transcript: **DEDUP** identical re-reads, **STALE** file contents superseded by later edits, **CLEAR** older large tool results (keeps the last ~4 full). Default **on** (`PI_TRANSCRIPT_PRUNE=0` disables). | Long sessions re-bill huge tool dumps every turn. Measured ~−5% tokens/request and ~−11% session total on a pruner bench; attacks the “uncleared tool output” cost. |
| **`session-index.ts`** | Lightweight cross-session index for recall. | Pi has no built-in long-term memory like some forks; this is the thin substitute. |

Also loaded from packages (not vendored here), for UX only — not the token
kernel: session auto-name/title, clipboard image, compact header, image
context pruner, markdown viewer (`@samfp/pi-essentials`).

---

## What else is in the kernel

These are the **always-on** efficiency layers (package names, purpose):

| Piece | Role |
|-------|------|
| **pi-slim** | Shorter default system prompt |
| **pi-tscg** | Compress tool *descriptions* (`tscg.json`, aggressive, 5-char desc floor — measured; don’t casual-retune) |
| **pi-lean-ctx** + **context-mode** | Small stable tool surface (`ctx_read`, `ctx_shell`, …), safer shell, less junk I/O |
| **pi-cache-optimizer** / **pi-cache-graph** | Prefer cache-friendly prompts and reuse |
| **pi-dynamic-workflows** | Multi-agent patterns (research, review, audit, …) when ce-lite fans out |
| **pi-autoresearch** | Measured experiment loops for harness tuning |
| **last30days-pi** | On-demand recent discourse research (not always-on web schemas) |
| **pi-herdr-btw**, **pi-continue**, **pi-context-usage**, … | Side questions, continue, usage visibility — small utilities |

Full install list is in the Install section. **Your `settings.json` providers
and default model stay machine-local** — the repo does not force a model.

---

## Where the ideas come from

- **Measured autoresearch** in this repo (`research/autoresearch-*`): terseness,
  thinking levels, tool-schema compression, transcript pruning, config overhead.
- **Harness engineering practice (2025–2026):** treat the *harness* (tools,
  context, orchestration) as the product; keep always-on surface minimal;
  progressive disclosure; separate gather vs judge; don’t churn the stable
  prompt prefix (cache).
- **Operator constraints:** non-developer / contract-style use, frequent model
  swaps, preference for terse output and long-session cost control.

Deep dives and raw logs stay in `research/` and `docs/` — the README stays the
map, not the lab notebook.

---

## Install / restore

```fish
git clone https://github.com/armchairfuturist-code/pi-harness-config
cd pi-harness-config
./install.sh            # deploy vendored files + verify
./install.sh --check    # drift check only
# ./install.sh --settings   # only if you want repo settings.json too
#                           # (skips by default: provider/model are yours)
```

Packages (once per machine):

```fish
pi install npm:pi-lean-ctx npm:context-mode npm:@quintinshaw/pi-dynamic-workflows \
  npm:pi-tscg npm:pi-slim npm:pi-cache-optimizer npm:pi-cache-graph npm:pi-context-usage \
  npm:pi-continue npm:pi-autoresearch npm:@plannotator/pi-extension \
  npm:@ogulancelik/pi-model-agents npm:@ogulcancelik/pi-model-thinking \
  npm:cc-safety-net npm:pi-herdr-btw npm:@samfp/pi-essentials \
  https://github.com/gvkhosla/last30days-pi
```

Point `settings.json` → `extensions` at  
`~/.pi/agent/extensions/transcript-pruner.ts` (and session-index if you use it).  
Do **not** leave a permanent path into your git checkout.

**Remove if present (old kernel):** `pi-mcp-adapter`, `pi-goal-list-loop-audit`,
`pi-web-access`, and any broken `delegate.ts` experiment.

---

## Verify

```fish
./bench/probe.sh      # fixed always-on overhead; target total ≤ 4400
./bench/measure.sh 3  # short task; checks_pass=1
```

---

## Snapshot of measured impact

Directional only — **your models will differ.**

| Lever | Result (as measured here) |
|-------|---------------------------|
| Kernel slimming (tools/skills/packages) | Fixed overhead on the order of ~4.3k tok (was higher pre-cuts) |
| Terseness directives in APPEND_SYSTEM | Large cut on behavioral suite (~17% in one campaign) |
| transcript-pruner DEDUP+STALE+CLEAR | ~−5% tokens/request, ~−11% session total on pruner bench |
| MCP bridge left off | Avoided ~3× tool-schema cost on file tasks |
| Always-on web removed | ~1k tok/request saved unless you reinstall it |

---

## Warnings (short)

- **Don’t casual-retune `tscg.json`.** Current aggressive floor is measured.
- **Don’t churn the system prompt** every session — stable prefixes cache.
- **Don’t set lean-ctx `enableMcp: true`** without a full re-measure.
- Harness edits should go through the canary/probe habit in `skills/harness-doctor`.

---

## Not in this repo

Secrets (`auth.json`), bulk session logs, `node_modules`, and machine-only
experiments. Your default provider/model belong in live `settings.json`, not
necessarily in git.

---

## Repo layout (quick)

```
APPEND_SYSTEM.md     # tiny always-on hook → ce-lite
settings.json        # example kernel (optional install)
tscg.json            # tool description compression
extensions/          # transcript-pruner, session-index
skills/ce-lite/      # orchestrator
skills/*             # on-demand diagnostics (doctor, rot, security, …)
workflows/           # model tier pins + saved workflow scripts
install.sh           # single source of truth for deploy paths
bench/               # probe + measure
research/            # campaign logs and findings
docs/                # deeper reference
```
