# Workflow — CE-lite (for the operator)

**There is nothing to memorize.** Say what you want in plain language. The ce-lite orchestrator routes it.

## The five shapes of work

**"What's X?" / "Draft a thank-you note"** — answered directly. Done.

**"Look up X"** — you get an answer with sources. Behind the scenes it fetches directly or runs a research workflow; you don't choose which.

**"Do this multi-step thing"** (organize files, produce a report, research-and-summarize, fix a recurring annoyance) — the orchestrator:
1. asks **only** the questions it genuinely can't default (one at a time),
2. states the acceptance terms up front (what "done" means),
3. gives a short plan summary,
4. executes — fanning out subagents when the work decomposes,
5. **verifies the result against the terms** before delivering,
6. tells you what happened in a few lines, and saves anything reusable for next time.

**"This is big and I'm not sure where to start"** — the orchestrator charts a wayfinder map: a set of decision tickets with blocking edges, then works them one at a time across sessions. You see questions and progress; the map structure is internal. When the way is clear, it hands off to a contract loop and gets it done.

**"Keep improving X"** (weekly metrics, optimization) — runs as a measured experiment loop.

## Side questions mid-work

Use `/btw` — opens a side thread that doesn't disturb the main conversation.

## What you will NOT need anymore

- No `/grill-with-docs → /to-spec → /to-tickets → /list → /implement` chains. Those skills still exist as the orchestrator's internal reference library — it routes to them by task shape, you never type them.
- No goal/list/loop commands. Contract tracking is internal.
- No model picking for subagents. Tiers (small/medium/big) route automatically; the one config file is `~/.pi/workflows/model-tiers.json`.
- No trigger words. The orchestrator may use workflows proactively.
- No manual wayfinding. When work is too big for one session, the orchestrator charts a map and works it ticket by ticket across sessions.

## When something goes wrong

- **"It did the small thing but I wanted the full treatment"** → say "run this as a contract" or "fan this out" — explicit always works.
- **"Web answers feel thin this week"** → `pi install npm:pi-web-access` for heavy-research periods (+~1,084 tok/request, documented trade). Remove after: `pi remove npm:pi-web-access`.
- **"I want to check the plan before it runs"** → say so ("show me the plan and wait"). The default is to proceed; pausing is one sentence.
- **Long job got interrupted** → workflows are journaled; say "resume the last workflow" — completed agents don't re-run.

## Monthly maintenance (5 minutes)

- `bench/probe.sh` → number stays ≤ 4,400 (with `CTX_MODE_ADMIN_TOOLS=0`). If it creeps up, something new is always-on — check what changed.
- Upstream radar: `research/ce-upstream-radar.md` — quick diff of watched repos, log adopt/adapt/ignore.
- Quarterly: re-check model tiers against the current catalog.
