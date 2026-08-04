# Reference — recall, decomposition, mechanic's shelf

Disclosed from `SKILL.md`. Read before non-trivial work in a familiar area, or when work may span sessions.

## Recall protocol

Artifacts only pay for themselves when they are read. Before non-trivial decisions or new work in a familiar area, spend a little context to save a lot.

First, keep recall current: if `~/.pi/agent/memory/sessions/` holds files you have not indexed this session, `ctx_index` that directory with source `session-log` (summaries are auto-written at every session shutdown; re-indexing is cheap).

Then:
1. `ctx_search` the knowledge store for the topic — prior decisions, gotchas, operator preferences, past session summaries (the store includes `memory/consolidated.md` learnings and the `session-log` source).
2. Check the repo's own records when they exist: ADRs / CONTEXT.md (respect superseded markers), the wayfinder map's Decisions-so-far, open tickets.
3. Then decide. If you contradict a recorded decision, say so explicitly and record the reversal — silent drift is how the record loses trust.

Skip this only for greenfield or genuinely novel questions.

## Decomposition routing

- Work spanning sessions (multi-session efforts, anything you would hand off) → **ce-lite wayfinding map** only. Read `wayfinding.md`. Artifacts live under `.scratch/wayfinder/`. The operator never sees the map structure — they see questions, a map summary, and ticket-by-ticket progress.
- Within-session fan-out (research, parallel checks, reviews, one-off builds) → ephemeral workflow runs: journaled, no tracker overhead.
- Never track the same work in both. When a worker's `new_tasks` field surfaces session-spanning work, publish it as a wayfinder-map ticket — do not carry it in chat.

**Do not** load the mattpocock `wayfinder` skill for ce-lite work. It is a separate protocol (CONTEXT.md / issue templates). If its files are present, treat them as optional inspiration, not the active map.

## Mechanic's shelf

Lazy reference — read the relevant skill internally when the task shape matches, **never mention the skill name to the operator**. The operator never types these; ce-lite routes to them.

| Task shape | Read this skill | How |
|---|---|---|
| Building a feature / vertical ticket | `implement` | Internally (composes `tdd` → `code-review` → acceptance); workflow subagent tier `medium` when fan-out helps |
| Test-first development | `tdd` | Internally, via workflow subagent (tier `medium`) |
| Researching external info (docs, APIs, sources) | `research` | Via workflow subagent (tier `small`) or direct fetch |
| Diagnosing a bug or recurring failure | `diagnosing-bugs` | Internally, via workflow subagent (tier `medium`) |
| Reviewing code or a deliverable | `code-review` | Via workflow `code-review` or `adversarial-review` pattern |
| Modeling a domain (terms, entities, states) | `domain-modeling` | Internally, during grilling — see `grilling.md` |
| Spike / approach still a bet | `prototype` | Internally before committing to implement |
| Design patterns inside an existing codebase | `codebase-design` | Internally when shaping structure |
| Merge conflicts | `resolving-merge-conflicts` | Internally when blocked on merge |
| Synthesizing a conversation into a formal spec | `to-spec` | Internally when contract terms need a frozen written spec |
| Breaking work into tracer-bullet tickets | `to-tickets` | Internally when wayfinding produces tickets — **map branch** defaults to `.scratch/wayfinder/` (not GitHub issues unless operator asks); see `wayfinding.md` |
| Handing off between sessions | `handoff` | Internally, during context health — see `context-health.md` |
| Composing a custom workflow script | `workflow-authoring` | Internally when built-in patterns don't fit |
| Choosing a workflow topology (DAG, fan-in, cycles) | `graph-engineering` | Internally when the execution shape is non-trivial |

When in doubt during wayfinding, grill (see `grilling.md`) and model the domain (`domain-modeling`). These two cover most fog.

### Never auto-invoke under ce-lite

| Skill | Why |
|---|---|
| `wayfinder` | Competing multi-session protocol. Use `wayfinding.md` + `.scratch/wayfinder/`. |
| `triage` | Tracker issue state-machine. ce-lite owns routing; no triage theater. |
| `ask-matt` | Pack meta-router; names skills. Irrelevant on the plain-language surface. |
| `setup-matt-pocock-skills` | Install/configure only; never mid-work. |
| `improve-codebase-architecture` | Operator-only heavyweight pass — only if they explicitly ask. |
| `grill-me` / `grill-with-docs` | Aliases of `grilling`. Load `grilling` + this companion's `grilling.md`. |

### How to hand off to a shelf skill

1. Recognize the situation from the table.
2. Read the skill's `SKILL.md` (and only its linked files if needed).
3. Follow it for that sub-task.
4. Return to the ce-lite loop (terms → plan → execute → verify → compound).
5. Still never name the skill to the operator.

If no row matches: stay in ce-lite. Do not hunt the catalog mid-flight.
