---
name: ask-matt
description: "Skill librarian. route: name the one skill for a task. audit: full portfolio pass — inventory, redundancies, gaps, keep/merge/kill. Covers agent-local and package-bundled skills."
disable-model-invocation: true
---

# ask-matt — skill librarian

One name for every skill this Pi can invoke. It **names**, never **fires**: user-invoked skills stay out of context until typed. Neither this skill nor the ones it lists live in memory — only `ce-lite` does.

Two branches. Default is **route**. Say `audit`, `portfolio`, `gaps`, or `prune all` for **audit**.

## Route

Done when: the best skill(s) for *this* task are named, with one-line why and origin; or the answer is `ce-lite`.

1. **Refresh inventory from disk** (source of truth — cards below are a **cache**):
   - **agent:** `~/.pi/agent/skills/*/SKILL.md` (follow symlinks). Dirs with no `SKILL.md` → **husk** (not routable).
   - **package (settings):** for each `~/.pi/agent/settings.json` → `packages` entry, find `skills/*/SKILL.md` under that package in `~/.pi/agent/npm/node_modules/` (skip `examples/`, `configs/`, nested `node_modules/`).
   - **package (direct npm tree):** also scan `~/.pi/agent/npm/*/skills/*/SKILL.md` and `~/.pi/agent/npm/@*/*/skills/*/SKILL.md` for installs that live outside `node_modules` (e.g. `last30days-pi`). Dedup by skill name if already agent-linked.
   - **drift (note only):** `~/.pi/skills/*/SKILL.md` names missing from agent — surface in audit; do not route from home alone if package or agent already provides it.
   - Missing from cards but on disk → read frontmatter `description` and route from that. Tag origin: `agent` | `package:<name>` | `husk`.
2. **Match** the task to a card or family (or fresh description). Prefer one skill. Name a second only for a clear two-step sequence.
3. **Answer:** skill name · origin · when it fits · invoke now vs stay in ce-lite. No fit → `ce-lite`.
4. **Light prune (optional)** — siblings of the match only. One line: keep / merge-candidate / kill-candidate. Full corpus → **audit**.

### Cards — agent (`~/.pi/agent/skills`)

| Skill | Job | When not |
|-------|-----|----------|
| `ce-lite` | Non-trivial engineering loop (scope → verify → close). Shelf work goes *through* it. | Trivial Q&A; harness-only checkup; pure teach/triage/design |
| `last30days` | What people actually say about a topic in the last ~30 days (Reddit/X/YouTube/HN/web engine + synthesis contract). Live body may be symlinked from `npm/last30days-pi`. | Evergreen docs, internal codebase Q&A, or generic web search without the social-signal pass |
| `teach` | Multi-session lesson in the workspace | One-off explanation |
| `triage` | Issues/external PRs: categorise → verify → brief | Coding without tracker workflow |
| `wait-what` | Last reply did not land — re-pitch (STE + ubiquitous language) | Fine-tuning a good answer |
| `writing-for-agents` | Author skills, AGENTS.md, CLAUDE.md, pointer docs | Product code implementation |
| `harness-doctor` | Harness check (packages/MCP/auth/runtime) or session review aggregates | Inside ordinary ce-lite work; skill portfolio questions → ask-matt |
| `context-rot-forensics` | JSONL session forensics / rot thresholds / sentinel | Live feature work |
| `graph-engineering` | Multi-agent topologies on pi primitives (when fan-out is not enough) | Single-agent tasks |
| `poor-mans-distill` | Session traces → curated few-shot skill (experimental) | Need a fine-tune or live coding |
| `shard-security` | Sandbox, project tool denies, credential hygiene | Low-sensitivity local work |
| `impeccable` | Frontend UI design/redesign/critique/polish (craft floor, playbooks) | Backend-only or non-UI |

### Cards — package families

Route to the **family** unless the user names a member. Origin = `package:<id>`.

#### `context-mode` · package:`context-mode`

Think-in-code / FTS knowledge base — keep large outputs out of the window.

| Member | Job |
|--------|-----|
| `context-mode` | Default: use ctx_execute / ctx_execute_file (and related) instead of dumping large bash/cat into context |
| `ctx-search` | Search the persistent FTS index / session memory |
| `ctx-index` | Index a file or directory into the knowledge base |
| `ctx-stats` | Session savings stats (read-only) |
| `ctx-doctor` | context-mode diagnostics |
| `ctx-upgrade` | Update/reinstall context-mode |
| `ctx-purge` | Wipe knowledge base (destructive) |
| `ctx-insight` | Open Insight analytics dashboard |

When not: tiny one-line commands you will consume verbatim.

#### `autoresearch` · package:`pi-autoresearch`

Autonomous experiment loops.

| Member | Job |
|--------|-----|
| `autoresearch-create` | Start/configure the optimize-in-a-loop session |
| `autoresearch-finalize` | Turn noisy experiment branches into clean reviewable branches |
| `autoresearch-hooks` | Author before/after iteration hooks |

When not: ordinary one-shot implementation (ce-lite).

#### `workflows` · package:`@quintinshaw/pi-dynamic-workflows`

| Member | Job |
|--------|-----|
| `workflow-patterns` | Run built-ins by shape: deep-research, adversarial-review, code-review, multi-perspective, codebase-audit |
| `workflow-authoring` | Write/edit/debug workflow JavaScript (not merely run one) |

When not: single-agent ce-lite work; running a named workflow with no authoring need → patterns or the `workflow` tool, not authoring.

Drift: `workflow-authoring` also appears under `~/.pi/skills` — package copy is the live one; home mirror is not a second skill.

### Packages with no skills

Installed packages that ship extensions/hooks only (not skill cards): e.g. `pi-lean-ctx`, `pi-slim`, `pi-continue`, `pi-tscg`, `pi-cache-optimizer`, `pi-context-usage`, `pi-herdr-btw`, `@plannotator/pi-extension`, `@ogulcancelik/pi-model-thinking`. Health of those → `harness-doctor`, not route.

## Audit

Triggers: `audit` · `portfolio` · `gaps` · `prune all`.

Done when: **every** agent skill dir and **every** package skill (settings packages + direct `npm/*/skills`) is accounted for; every overlap cluster has a recommendation; gaps vs the lens are listed; actions ranked. Read bodies for overlap suspects; descriptions suffice for clear singletons.

### 1. Inventory

Rebuild via the same disk rules as Route step 1. For each entry:

- name · origin (`agent` / `package:<id>` / `husk`) · has `SKILL.md`? · symlink target if any · invocation · one-line job · route card or family present?

### 2. Redundancy

Cluster overlapping triggers or the same job (across agent **and** package).

| Finding | Action |
|---------|--------|
| Same job, two names | merge or kill one |
| Same job, different altitude | keep both; sharpen pointers |
| Agent symlink/copy vs package body | single source — symlink OK; don't fork bodies |
| Dead / empty husk / uninvoked | kill candidate — never mark a skill the user relies on without asking |

Apply `writing-for-agents` for merge/split/pointer decisions; do not restate it here.

### 3. Gaps

| Lens | Covered if… |
|------|-------------|
| Engineering loop | `ce-lite` |
| Recent social/web signal research | `last30days` |
| Skill / doc authoring | `writing-for-agents` |
| Librarian / which-skill | `ask-matt` |
| Teach | `teach` |
| Issue/PR workflow | `triage` |
| Harness health | `harness-doctor` |
| Session rot | `context-rot-forensics` |
| Multi-agent topology | `graph-engineering` |
| Trace distillation | `poor-mans-distill` |
| Sensitive-session security | `shard-security` |
| Re-pitch / clarify | `wait-what` |
| Frontend craft | `impeccable` |
| Large-output / FTS context | `context-mode` family |
| Autoresearch loops | `autoresearch` family |
| Workflow run / author | `workflows` family |

Report: missing job · weak description · live skill absent from cards/families · husk · home-only drift.

### 4. Output

```
## Inventory
(name | origin | job | card/family? | husk?)

## Overlaps
(cluster → recommendation)

## Gaps
(lens miss or pointer miss)

## Actions (ranked)
1. …
```

No drive-by rewrites or deletes unless the user asked. Recommend; then wait.
